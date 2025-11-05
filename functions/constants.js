// 固定常量 - 不要修改
export const CONSTANTS = {
  // API配置
  API_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  
  // 默认值
  DEFAULTS: {
    CONCURRENCY: 5,
    OCR_MODEL: "qwen-vl-max-latest",
    DECISION_MODEL: "qwen-max-latest",
    TIMEOUT: 30000,
    MAX_SIZE_MB: 10
  },
  
  // 错误消息
  ERRORS: {
    INVALID_IMAGE: "图片格式无效，请上传PNG/JPG格式的图片",
    IMAGE_TOO_LARGE: "图片大小超过限制，请上传小于10MB的图片",
    NO_VALID_RESULTS: "未能识别出有效内容，请检查图片清晰度或重试",
    API_ERROR: "识别服务暂时不可用，请稍后重试",
    TIMEOUT: "处理超时，请重试",
    NETWORK_ERROR: "网络错误，请检查网络连接",
    PARSE_ERROR: "结果解析失败，请重试",
    NO_IMAGE: "请先上传图片",
    INVALID_CONCURRENCY: "并发次数配置无效，必须在1-10之间"
  },
  
  // 进度状态
  PROGRESS: {
    UPLOADING: "正在上传图片...",
    OCR_PROCESSING: "正在识别文字 ({current}/{total})...",
    CONSOLIDATING: "正在整合结果...",
    COMPLETE: "识别完成！",
    COPYING: "正在复制...",
    COPIED: "已复制到剪贴板！"
  },
  
  // HTTP状态码
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
    TIMEOUT: 504
  }
};