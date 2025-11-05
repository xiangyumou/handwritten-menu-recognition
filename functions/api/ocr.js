import OpenAI from 'openai';

// 加载配置
async function loadConfig() {
    try {
        // 在Cloudflare Workers环境中，需要使用fetch读取文件
        const configUrl = new URL('../../config.json', import.meta.url);
        const response = await fetch(configUrl);
        return await response.json();
    } catch (error) {
        console.error('加载配置失败:', error);
        // 返回默认配置
        return {
            ocr: {
                concurrency: 5,
                ocrModel: "qwen-vl-max-latest",
                decisionModel: "qwen-max-latest",
                enableThinking: false,
                timeout: 30000
            },
            prompt: {
                ocrInstruction: "请识别图片中的手写文字内容，这是一份购物清单或库存清单。\n\n要求：\n1. 识别所有手写的中文文字\n2. 按照【物品名称、数量、单位、备注】的格式整理\n3. 单位是指计量单位，如：个、瓶、袋、包、斤、公斤、克、箱、盒等\n4. 如果某项没有数量、单位或备注，用空字符串表示\n5. 返回JSON数组格式[[\"物品\", \"数量\", \"单位\", \"备注\"], ...]\n\n直接返回JSON数组，不要任何其他解释文字。",
                decisionInstruction: "以下是多次OCR识别的结果，请基于原图和这些结果，给出最准确的最终结果。\n\n要求：\n1. 综合所有识别结果，选择最准确的内容\n2. 返回JSON数组格式：[[\"物品\", \"数量\", \"单位\", \"备注\"], ...]\n3. 单位是指计量单位，如：个、瓶、袋、包、斤、公斤、克、箱、盒等\n4. 直接返回JSON数组，不要任何其他解释文字"
            }
        };
    }
}

// 解析JSON结果
function parseJSONResult(content) {
    try {
        // 尝试提取JSON数组
        const jsonMatch = content.match(/\[\s*\[[\s\S]*?\]\s*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
        return null;
    } catch (error) {
        console.error('JSON解析失败:', error);
        return null;
    }
}

// 执行单次OCR识别
async function performOCR(client, imageBase64, prompt, model, attemptId, enableThinking) {
    try {
        console.log(`开始第${attemptId + 1}次OCR识别`);
        
        const completion = await client.chat.completions.create({
            model: model,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: { url: imageBase64 }
                    },
                    {
                        type: "text",
                        text: prompt
                    }
                ]
            }],
            extra_body: {
                enable_thinking: enableThinking
            }
        });
        
        const content = completion.choices[0].message.content;
        console.log(`第${attemptId + 1}次OCR结果:`, content.substring(0, 100));
        
        return content;
    } catch (error) {
        console.error(`第${attemptId + 1}次OCR失败:`, error);
        throw error;
    }
}

// 整合多次识别结果
async function consolidateResults(client, imageBase64, validResults, prompt, model) {
    try {
        console.log('开始整合结果，有效结果数:', validResults.length);
        
        const resultsText = validResults
            .map((result, i) => `第${i + 1}次识别结果：\n${JSON.stringify(result, null, 2)}`)
            .join('\n\n');
        
        const fullPrompt = `${prompt}\n\n${resultsText}`;
        
        const completion = await client.chat.completions.create({
            model: model,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: { url: imageBase64 }
                    },
                    {
                        type: "text",
                        text: fullPrompt
                    }
                ]
            }]
        });
        
        const content = completion.choices[0].message.content;
        console.log('整合结果:', content);
        
        return parseJSONResult(content);
    } catch (error) {
        console.error('整合结果失败:', error);
        throw error;
    }
}

// 发送进度更新
function sendProgress(encoder, progress, message, data = null) {
    const progressData = {
        type: 'progress',
        progress,
        message,
        data
    };
    return encoder.encode(JSON.stringify(progressData) + '\n');
}

// 发送错误
function sendError(encoder, code, message) {
    const errorData = {
        type: 'error',
        error: { code, message }
    };
    return encoder.encode(JSON.stringify(errorData) + '\n');
}

// 发送最终结果
function sendResult(encoder, items, metadata) {
    const resultData = {
        type: 'result',
        success: true,
        data: { items, metadata }
    };
    return encoder.encode(JSON.stringify(resultData) + '\n');
}

// 主处理函数（流式响应版本）
export async function onRequestPost(context) {
    const startTime = Date.now();
    
    try {
        // 解析请求体
        const requestBody = await context.request.json();
        const { image, concurrency, enableThinking } = requestBody;
        
        // 验证参数
        if (!image) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'NO_IMAGE',
                    message: '请提供图片数据'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 加载配置
        const config = await loadConfig();
        
        // 使用请求参数或配置中的并发数
        const actualConcurrency = concurrency || config.ocr.concurrency || 5;
        
        // 验证并发数
        if (actualConcurrency < 1 || actualConcurrency > 10) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INVALID_CONCURRENCY',
                    message: '并发次数必须在1-10之间'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 初始化OpenAI客户端
        const apiKey = context.env.DASHSCOPE_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'NO_API_KEY',
                    message: 'API密钥未配置'
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const client = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });
        
        // 创建流式响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // 发送初始进度
                    controller.enqueue(sendProgress(encoder, 5, '正在准备识别...'));
                    
                    console.log(`开始${actualConcurrency}次并发OCR识别`);
                    controller.enqueue(sendProgress(encoder, 10, `开始${actualConcurrency}次并发识别...`));
                    
                    // 并发执行OCR识别，追踪完成进度
                    let completedCount = 0;
                    const ocrPromises = Array.from({ length: actualConcurrency }, async (_, i) => {
                        const result = await performOCR(
                            client,
                            image,
                            config.prompt.ocrInstruction,
                            config.ocr.ocrModel,
                            i,
                            enableThinking || config.ocr.enableThinking
                        );
                        
                        completedCount++;
                        const progress = 10 + Math.floor((completedCount / actualConcurrency) * 60);
                        controller.enqueue(sendProgress(
                            encoder,
                            progress,
                            `识别进度：${completedCount}/${actualConcurrency}`
                        ));
                        
                        return result;
                    });
                    
                    const ocrResults = await Promise.all(ocrPromises);
                    controller.enqueue(sendProgress(encoder, 70, '所有识别请求已完成'));
                    
                    // 解析所有结果
                    const validResults = ocrResults
                        .map(result => parseJSONResult(result))
                        .filter(result => result !== null);
                    
                    console.log(`有效识别结果数: ${validResults.length}/${actualConcurrency}`);
                    controller.enqueue(sendProgress(
                        encoder,
                        75,
                        `解析完成，有效结果：${validResults.length}/${actualConcurrency}`
                    ));
                    
                    if (validResults.length === 0) {
                        controller.enqueue(sendError(
                            encoder,
                            'NO_VALID_RESULTS',
                            '未能识别出有效内容，请检查图片清晰度'
                        ));
                        controller.close();
                        return;
                    }
                    
                    // 如果只有一个有效结果，直接返回
                    let finalResult;
                    if (validResults.length === 1) {
                        controller.enqueue(sendProgress(encoder, 90, '准备返回识别结果...'));
                        finalResult = validResults[0];
                    } else {
                        // 使用决策模型整合多个结果
                        controller.enqueue(sendProgress(encoder, 80, '正在整合多个识别结果...'));
                        
                        finalResult = await consolidateResults(
                            client,
                            image,
                            validResults,
                            config.prompt.decisionInstruction,
                            config.ocr.decisionModel
                        );
                        
                        controller.enqueue(sendProgress(encoder, 95, '结果整合完成'));
                    }
                    
                    if (!finalResult) {
                        controller.enqueue(sendError(
                            encoder,
                            'CONSOLIDATION_FAILED',
                            '结果整合失败'
                        ));
                        controller.close();
                        return;
                    }
                    
                    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`处理完成，耗时: ${processingTime}秒`);
                    
                    // 发送最终结果
                    controller.enqueue(sendResult(
                        encoder,
                        finalResult,
                        {
                            concurrencyUsed: actualConcurrency,
                            validAttempts: validResults.length,
                            processingTime: parseFloat(processingTime)
                        }
                    ));
                    
                    controller.close();
                    
                } catch (error) {
                    console.error('OCR处理错误:', error);
                    controller.enqueue(sendError(
                        encoder,
                        'INTERNAL_ERROR',
                        error.message || '识别服务暂时不可用，请稍后重试'
                    ));
                    controller.close();
                }
            }
        });
        
        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
        
    } catch (error) {
        console.error('OCR处理错误:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || '识别服务暂时不可用，请稍后重试'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}