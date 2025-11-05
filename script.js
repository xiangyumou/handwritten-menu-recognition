// 全局变量
let config = null;
let selectedFile = null;
let currentImageBase64 = null;
let accessToken = null;

// 表格选中状态
let isSelecting = false;
let selectionStart = null;
let selectedCells = new Set();

// DOM元素
const elements = {
    dropzone: null,
    fileInput: null,
    previewSection: null,
    previewImage: null,
    removeImageBtn: null,
    fileInfo: null,
    recognizeBtn: null,
    progressSection: null,
    progressText: null,
    progressPercent: null,
    progressFill: null,
    progressStatus: null,
    resultSection: null,
    resultTbody: null,
    copyBtn: null,
    retryBtn: null,
    errorSection: null,
    errorMessage: null,
    errorRetryBtn: null
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化DOM元素
    initializeElements();
    
    // 读取URL中的token
    const urlParams = new URLSearchParams(window.location.search);
    accessToken = urlParams.get('token');
    
    // 加载配置
    await loadConfig();
    
    // 设置事件监听器
    setupEventListeners();
});

// 初始化DOM元素
function initializeElements() {
    elements.dropzone = document.getElementById('dropzone');
    elements.fileInput = document.getElementById('file-input');
    elements.previewSection = document.getElementById('preview-section');
    elements.previewImage = document.getElementById('preview-image');
    elements.removeImageBtn = document.getElementById('remove-image');
    elements.fileInfo = document.getElementById('file-info');
    elements.recognizeBtn = document.getElementById('recognize-btn');
    elements.progressSection = document.getElementById('progress-section');
    elements.progressText = document.getElementById('progress-text');
    elements.progressPercent = document.getElementById('progress-percent');
    elements.progressFill = document.getElementById('progress-fill');
    elements.progressStatus = document.getElementById('progress-status');
    elements.resultSection = document.getElementById('result-section');
    elements.resultTbody = document.getElementById('result-tbody');
    elements.copyBtn = document.getElementById('copy-btn');
    elements.retryBtn = document.getElementById('retry-btn');
    elements.errorSection = document.getElementById('error-section');
    elements.errorMessage = document.getElementById('error-message');
    elements.errorRetryBtn = document.getElementById('error-retry-btn');
}

// 加载配置
async function loadConfig() {
    try {
        const response = await fetch('/config.json');
        config = await response.json();
        
        // 应用UI配置
        document.getElementById('app-title').textContent = config.ui.title;
        document.getElementById('app-description').textContent = config.ui.description;
        document.title = config.ui.title;
    } catch (error) {
        console.error('加载配置失败:', error);
        config = {
            ocr: { concurrency: 5 },
            upload: { maxSizeMB: 10, allowedFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] },
            ui: { thumbnailSize: 200 }
        };
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 拖拽事件
    elements.dropzone.addEventListener('click', () => elements.fileInput.click());
    elements.dropzone.addEventListener('dragover', handleDragOver);
    elements.dropzone.addEventListener('dragleave', handleDragLeave);
    elements.dropzone.addEventListener('drop', handleDrop);
    
    // 文件选择
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // 移除图片
    elements.removeImageBtn.addEventListener('click', resetUpload);
    
    // 开始识别
    elements.recognizeBtn.addEventListener('click', startRecognition);
    
    // 复制按钮
    elements.copyBtn.addEventListener('click', copyToClipboard);
    
    // 重试按钮
    elements.retryBtn.addEventListener('click', resetUpload);
    elements.errorRetryBtn.addEventListener('click', () => {
        hideError();
        startRecognition();
    });
    
    // 全局粘贴事件（支持粘贴图片）
    document.addEventListener('paste', handleGlobalPaste);
    
    // 全局鼠标抬起事件（结束选中）
    document.addEventListener('mouseup', () => {
        isSelecting = false;
    });
    
    // 全局键盘事件（支持Ctrl+C复制）
    document.addEventListener('keydown', handleKeyDown);
    
    // 全局右键菜单（阻止默认菜单，保持选中状态）
    document.addEventListener('contextmenu', handleContextMenu);
}

// 拖拽处理
function handleDragOver(e) {
    e.preventDefault();
    elements.dropzone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropzone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropzone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// 文件选择处理
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// 处理文件
function handleFile(file) {
    // 验证文件类型
    if (!config.upload.allowedFormats.includes(file.type)) {
        showError('图片格式无效，请上传PNG/JPG格式的图片');
        return;
    }
    
    // 验证文件大小
    const maxSize = config.upload.maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
        showError(`图片大小超过限制，请上传小于${config.upload.maxSizeMB}MB的图片`);
        return;
    }
    
    selectedFile = file;
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageBase64 = e.target.result;
        elements.previewImage.src = currentImageBase64;
        elements.fileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        
        // 显示预览区域
        elements.dropzone.style.display = 'none';
        elements.previewSection.style.display = 'block';
        elements.recognizeBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 重置上传
function resetUpload() {
    selectedFile = null;
    currentImageBase64 = null;
    elements.fileInput.value = '';
    
    elements.dropzone.style.display = 'block';
    elements.previewSection.style.display = 'none';
    elements.recognizeBtn.style.display = 'none';
    elements.progressSection.style.display = 'none';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
}

// 开始识别（流式进度版本）
async function startRecognition() {
    if (!selectedFile || !currentImageBase64) {
        showError('请先上传图片');
        return;
    }
    
    // 隐藏其他区域，显示进度
    elements.recognizeBtn.style.display = 'none';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    elements.progressSection.style.display = 'block';
    
    // 重置进度
    updateProgress(0, '正在连接识别服务...');
    
    try {
        // 准备请求头
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 如果有token，添加到请求头
        if (accessToken) {
            headers['X-Access-Token'] = accessToken;
        }
        
        // 调用API（流式响应）
        const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                image: currentImageBase64,
                concurrency: config.ocr.concurrency,
                enableThinking: config.ocr.enableThinking || false
            })
        });
        
        if (!response.ok) {
            throw new Error('识别服务请求失败');
        }
        
        // 读取流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            // 将新数据添加到缓冲区
            buffer += decoder.decode(value, { stream: true });
            
            // 按行分割数据
            const lines = buffer.split('\n');
            
            // 保留最后一个不完整的行
            buffer = lines.pop() || '';
            
            // 处理每一行
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        handleStreamMessage(data);
                    } catch (e) {
                        console.error('解析进度数据失败:', e, line);
                    }
                }
            }
        }
        
        // 处理剩余的缓冲区数据
        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer);
                handleStreamMessage(data);
            } catch (e) {
                console.error('解析最后的进度数据失败:', e);
            }
        }
        
    } catch (error) {
        console.error('识别错误:', error);
        elements.progressSection.style.display = 'none';
        showError(error.message || '识别服务暂时不可用，请稍后重试');
    }
}

// 处理流式消息
function handleStreamMessage(data) {
    switch (data.type) {
        case 'progress':
            // 更新进度条
            updateProgress(data.progress, data.message);
            break;
            
        case 'error':
            // 显示错误
            elements.progressSection.style.display = 'none';
            showError(data.error.message || '识别失败');
            break;
            
        case 'result':
            // 显示结果
            if (data.success && data.data?.items) {
                updateProgress(100, '识别完成！');
                setTimeout(() => {
                    displayResults(data.data.items);
                }, 500);
            } else {
                elements.progressSection.style.display = 'none';
                showError('识别结果格式错误');
            }
            break;
            
        default:
            console.warn('未知的消息类型:', data.type);
    }
}

// 更新进度
function updateProgress(percent, text, status = '') {
    elements.progressPercent.textContent = percent + '%';
    elements.progressText.textContent = text;
    elements.progressFill.style.width = percent + '%';
    elements.progressStatus.textContent = status;
}

// 显示结果（Excel式可编辑表格）
function displayResults(items) {
    elements.progressSection.style.display = 'none';
    elements.resultSection.style.display = 'block';
    
    // 清空表格
    elements.resultTbody.innerHTML = '';
    
    // 填充数据（4列：商品名称、数量、单位、备注）
    items.forEach((item, rowIndex) => {
        const row = document.createElement('tr');
        
        // 创建可编辑的单元格
        for (let colIndex = 0; colIndex < 4; colIndex++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            td.textContent = item[colIndex] || '';
            td.dataset.row = rowIndex;
            td.dataset.col = colIndex;
            
            // 添加单元格事件监听
            td.addEventListener('mousedown', handleCellMouseDown);
            td.addEventListener('mouseover', handleCellMouseOver);
            td.addEventListener('focus', handleCellFocus);
            td.addEventListener('blur', handleCellBlur);
            
            row.appendChild(td);
        }
        
        elements.resultTbody.appendChild(row);
    });
    
    // 设置表格选中功能
    setupTableSelection();
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// 显示错误
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorSection.style.display = 'block';
    elements.progressSection.style.display = 'none';
}

// 隐藏错误
function hideError() {
    elements.errorSection.style.display = 'none';
}

// ========== Excel式表格功能 ==========

// 设置表格选中功能
function setupTableSelection() {
    // 此函数用于初始化，具体逻辑在单元格事件中
}

// 单元格鼠标按下
function handleCellMouseDown(e) {
    // 双击进入编辑模式
    if (e.detail === 2) {
        e.target.focus();
        return;
    }
    
    // 单击选中模式
    if (e.detail === 1) {
        e.preventDefault();
        
        isSelecting = true;
        selectedCells.clear();
        
        // 清除之前的选中样式
        document.querySelectorAll('td.selected').forEach(td => {
            td.classList.remove('selected');
        });
        
        selectionStart = {
            row: parseInt(e.target.dataset.row),
            col: parseInt(e.target.dataset.col)
        };
        
        e.target.classList.add('selected');
        selectedCells.add(e.target);
    }
}

// 单元格鼠标悬停
function handleCellMouseOver(e) {
    if (!isSelecting || !selectionStart) return;
    
    const endRow = parseInt(e.target.dataset.row);
    const endCol = parseInt(e.target.dataset.col);
    
    // 清除之前的选中样式
    document.querySelectorAll('td.selected').forEach(td => {
        td.classList.remove('selected');
    });
    selectedCells.clear();
    
    // 计算选中范围
    const minRow = Math.min(selectionStart.row, endRow);
    const maxRow = Math.max(selectionStart.row, endRow);
    const minCol = Math.min(selectionStart.col, endCol);
    const maxCol = Math.max(selectionStart.col, endCol);
    
    // 选中范围内的所有单元格
    const allCells = elements.resultTbody.querySelectorAll('td');
    allCells.forEach(td => {
        const row = parseInt(td.dataset.row);
        const col = parseInt(td.dataset.col);
        
        if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
            td.classList.add('selected');
            selectedCells.add(td);
        }
    });
}

// 单元格获得焦点（进入编辑模式）
function handleCellFocus(e) {
    // 进入编辑模式时清除选中
    if (selectedCells.size > 0) {
        document.querySelectorAll('td.selected').forEach(td => {
            td.classList.remove('selected');
        });
        selectedCells.clear();
        isSelecting = false;
    }
}

// 单元格失去焦点
function handleCellBlur(e) {
    // 失去焦点时保存内容（可选）
}

// 键盘事件处理（Ctrl+C复制）
function handleKeyDown(e) {
    // Ctrl+C 或 Cmd+C（Mac）
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // 如果有选中的单元格，复制选中内容
        if (selectedCells.size > 0) {
            e.preventDefault();
            copySelectedCells();
        }
    }
}

// 右键菜单处理
function handleContextMenu(e) {
    // 如果右键点击的是选中的单元格，阻止默认菜单并复制
    if (e.target.tagName === 'TD' && e.target.classList.contains('selected')) {
        e.preventDefault();
        copySelectedCells();
    }
}

// 复制选中的单元格
async function copySelectedCells() {
    if (selectedCells.size === 0) return;
    
    try {
        const textToCopy = getSelectedCellsText();
        await navigator.clipboard.writeText(textToCopy);
        
        // 短暂提示（不改变按钮文本）
        console.log('已复制选中内容');
    } catch (error) {
        console.error('复制失败:', error);
    }
}

// 复制到剪贴板（始终复制整个表格）
async function copyToClipboard() {
    try {
        // 始终复制整个表格（含表头）
        const textToCopy = getAllTableText();
        
        // 复制到剪贴板
        await navigator.clipboard.writeText(textToCopy);
        
        // 显示成功提示
        elements.copyBtn.textContent = '✓ 已复制';
        elements.copyBtn.classList.add('copied');
        
        setTimeout(() => {
            elements.copyBtn.textContent = '📋 复制全部';
            elements.copyBtn.classList.remove('copied');
        }, 2000);
        
    } catch (error) {
        console.error('复制失败:', error);
        showError('复制失败，请手动选择并复制');
    }
}

// 获取选中单元格的文本
function getSelectedCellsText() {
    if (selectedCells.size === 0) return '';
    
    // 组织选中的单元格为表格结构
    const cellsArray = Array.from(selectedCells);
    const rows = {};
    
    cellsArray.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        if (!rows[row]) {
            rows[row] = {};
        }
        rows[row][col] = cell.textContent;
    });
    
    // 转换为TSV格式
    const sortedRows = Object.keys(rows).sort((a, b) => parseInt(a) - parseInt(b));
    const lines = sortedRows.map(rowKey => {
        const row = rows[rowKey];
        const sortedCols = Object.keys(row).sort((a, b) => parseInt(a) - parseInt(b));
        return sortedCols.map(colKey => row[colKey]).join('\t');
    });
    
    return lines.join('\n');
}

// 获取全部表格文本
function getAllTableText() {
    const rows = elements.resultTbody.querySelectorAll('tr');
    const data = [];
    
    // 添加表头
    data.push(['物品名称', '数量', '单位', '备注'].join('\t'));
    
    // 添加数据行
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => cell.textContent);
        data.push(rowData.join('\t'));
    });
    
    return data.join('\n');
}

// ========== 粘贴图片功能 ==========

// 全局粘贴事件处理
function handleGlobalPaste(e) {
    // 如果正在编辑表格单元格，不处理
    if (document.activeElement.tagName === 'TD' && document.activeElement.contentEditable === 'true') {
        return;
    }
    
    // 检查剪贴板中是否有图片
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 找到图片类型的item
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            
            const blob = item.getAsFile();
            if (blob) {
                handlePastedImage(blob);
            }
            break;
        }
    }
}

// 处理粘贴的图片
function handlePastedImage(blob) {
    // 验证文件大小
    const maxSize = config.upload.maxSizeMB * 1024 * 1024;
    if (blob.size > maxSize) {
        showError(`图片大小超过限制，请上传小于${config.upload.maxSizeMB}MB的图片`);
        return;
    }
    
    // 创建File对象
    const file = new File([blob], 'pasted-image.png', { type: blob.type });
    selectedFile = file;
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageBase64 = e.target.result;
        elements.previewImage.src = currentImageBase64;
        elements.fileInfo.textContent = `粘贴的图片 (${formatFileSize(blob.size)})`;
        
        // 显示预览区域
        elements.dropzone.style.display = 'none';
        elements.previewSection.style.display = 'block';
        elements.recognizeBtn.style.display = 'block';
        
        // 隐藏结果区域
        elements.resultSection.style.display = 'none';
        elements.errorSection.style.display = 'none';
    };
    reader.readAsDataURL(blob);
}