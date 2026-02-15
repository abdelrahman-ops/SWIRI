class ApiResponse {
    static send(res, { statusCode = 200, message = "Request successful", data = null, meta = null }) {
        return res.status(statusCode).json({
        success: true,
        statusCode,
        message,
        data,
        meta,
        requestId: res.locals.requestId,
        timestamp: new Date().toISOString()
        });
    }

    static ok(res, data, message = "Request successful", meta = null) {
        return this.send(res, { statusCode: 200, message, data, meta });
    }

    static created(res, data, message = "Resource created", meta = null) {
        return this.send(res, { statusCode: 201, message, data, meta });
    }
}

export default ApiResponse;
