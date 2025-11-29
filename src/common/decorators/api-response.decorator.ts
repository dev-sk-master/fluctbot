import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      description: 'Successfully retrieved items',
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              statusCode: {
                type: 'number',
                example: 200,
              },
              message: {
                type: 'string',
                example: 'Success',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        ],
      },
    }),
  );
};

