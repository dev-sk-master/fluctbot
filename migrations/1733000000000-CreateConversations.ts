import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateConversations1733000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversations table
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'platform',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'platform_identifier',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'thread_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'last_message_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_archived',
            type: 'boolean',
            default: false,
          },
        ],
        indices: [
          {
            name: 'idx_conversations_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'idx_conversations_platform_identifier',
            columnNames: ['platform_identifier'],
          },
          {
            name: 'idx_conversations_user_platform',
            columnNames: ['user_id', 'platform'],
          },
          {
            name: 'idx_conversations_thread_id',
            columnNames: ['thread_id'],
            isUnique: true,
          },
          {
            name: 'idx_conversations_last_message',
            columnNames: ['last_message_at'],
          },
          {
            name: 'idx_conversations_user_platform_identifier',
            columnNames: ['user_id', 'platform', 'platform_identifier'],
            isUnique: true,
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint (check if it exists first)
    const conversationsTable = await queryRunner.getTable('conversations');
    const userForeignKey = conversationsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1 && fk.referencedTableName === 'users',
    );
    
    if (!userForeignKey) {
      await queryRunner.createForeignKey(
        'conversations',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );
    }

    // Create conversation_messages table
    await queryRunner.createTable(
      new Table({
        name: 'conversation_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'conversation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'message_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'content_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'content_text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'content_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'tool_calls',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'idx_conversation_messages_conversation_id',
            columnNames: ['conversation_id'],
          },
          {
            name: 'idx_conversation_messages_created_at',
            columnNames: ['created_at'],
          },
          {
            name: 'idx_conversation_messages_role',
            columnNames: ['role'],
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint for conversation_messages (check if it exists first)
    const conversationMessagesTable = await queryRunner.getTable('conversation_messages');
    const conversationForeignKey = conversationMessagesTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('conversation_id') !== -1 && fk.referencedTableName === 'conversations',
    );
    
    if (!conversationForeignKey) {
      await queryRunner.createForeignKey(
        'conversation_messages',
        new TableForeignKey({
          columnNames: ['conversation_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'conversations',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('conversation_messages');
    await queryRunner.dropTable('conversations');
  }
}

