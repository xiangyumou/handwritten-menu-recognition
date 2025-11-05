/**
 * Cloudflare Pages Functions Middleware
 * 用于验证访问token
 */

// Token验证中间件
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    
    // 如果是静态资源（非API请求），直接放行
    if (!url.pathname.startsWith('/api/')) {
        // 对于首页，检查URL参数中的token
        if (url.pathname === '/' || url.pathname === '/index.html') {
            const token = url.searchParams.get('token');
            const expectedToken = env.ACCESS_TOKEN;
            
            // 如果配置了ACCESS_TOKEN但token不匹配，返回401
            if (expectedToken && token !== expectedToken) {
                return new Response(
                    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问受限</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
            background: #f5f5f7;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .error-container {
            background: white;
            border-radius: 18px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            max-width: 500px;
            width: 100%;
            padding: 48px;
            text-align: center;
        }
        .error-icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        h1 {
            color: #1d1d1f;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        p {
            color: #86868b;
            font-size: 17px;
            line-height: 1.5;
            margin-bottom: 32px;
        }
        .hint {
            background: #f5f5f7;
            border-radius: 12px;
            padding: 16px;
            font-size: 14px;
            color: #6e6e73;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">🔒</div>
        <h1>访问受限</h1>
        <p>此服务需要有效的访问令牌</p>
        <div class="hint">
            请使用正确的URL格式访问：<br>
            <strong>?token=your_token</strong>
        </div>
    </div>
</body>
</html>`,
                    {
                        status: 401,
                        headers: {
                            'Content-Type': 'text/html; charset=utf-8'
                        }
                    }
                );
            }
        }
        
        return next();
    }
    
    // API请求需要验证header中的token
    const token = request.headers.get('X-Access-Token');
    const expectedToken = env.ACCESS_TOKEN;
    
    // 如果配置了ACCESS_TOKEN但token不匹配，返回401
    if (expectedToken && token !== expectedToken) {
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '无效的访问令牌'
                }
            }),
            {
                status: 401,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
    
    // Token验证通过，继续处理请求
    return next();
}