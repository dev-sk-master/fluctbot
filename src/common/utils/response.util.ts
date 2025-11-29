export class ResponseUtil {
  static success<T>(data: T, message = 'Success') {
    return {
      data,
      statusCode: 200,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success',
  ) {
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCode: 200,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}

