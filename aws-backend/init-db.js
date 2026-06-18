const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'localhost',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'DEFAULT', secretAccessKey: 'DEFAULT' }
});

const paramsConnections = {
  TableName: 'serverless-chat-backend-connections-dev',
  KeySchema: [
    { AttributeName: 'connectionId', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'connectionId', AttributeType: 'S' }
  ],
  ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
};

const paramsMessages = {
  TableName: 'serverless-chat-backend-messages-dev',
  KeySchema: [
    { AttributeName: 'roomName', KeyType: 'HASH' },
    { AttributeName: 'timestamp', KeyType: 'RANGE' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'roomName', AttributeType: 'S' },
    { AttributeName: 'timestamp', AttributeType: 'N' }
  ],
  ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
};

async function createTable(params) {
  try {
    await client.send(new CreateTableCommand(params));
    console.log(`Table ${params.TableName} created successfully.`);
  } catch (err) {
    if (err.name === 'ResourceInUseException') {
      console.log(`Table ${params.TableName} already exists.`);
    } else {
      console.error(`Error creating table ${params.TableName}:`, err);
    }
  }
}

async function initDb() {
  await createTable(paramsConnections);
  await createTable(paramsMessages);
}

initDb();
