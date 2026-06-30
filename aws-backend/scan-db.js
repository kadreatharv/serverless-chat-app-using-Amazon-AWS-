const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { ScanCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: 'localhost',
  endpoint: 'http://127.0.0.1:8000',
  credentials: { accessKeyId: 'DEFAULT', secretAccessKey: 'DEFAULT' }
});

const docClient = DynamoDBDocumentClient.from(client);

async function scan() {
  const data = await docClient.send(new ScanCommand({
    TableName: 'serverless-chat-backend-connections-dev'
  }));
  console.log('Connections:', data.Items);
}

scan();
