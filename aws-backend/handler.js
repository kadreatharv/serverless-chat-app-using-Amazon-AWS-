const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, DeleteCommand, ScanCommand, QueryCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const IS_OFFLINE = process.env.IS_OFFLINE;

let dynamoDbClient;
if (IS_OFFLINE === 'true') {
  dynamoDbClient = new DynamoDBClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'DEFAULT', secretAccessKey: 'DEFAULT' }
  });
} else {
  dynamoDbClient = new DynamoDBClient({});
}

const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const success = { statusCode: 200, body: 'Success' };

function getApiGatewayClient(event) {
  let endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  if (IS_OFFLINE === 'true') {
    endpoint = 'http://localhost:4001';
  }
  return new ApiGatewayManagementApiClient({ apiVersion: '2018-11-29', endpoint });
}

async function getRoomConnections(roomName) {
  const data = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'roomName = :roomName',
    ExpressionAttributeValues: { ':roomName': roomName }
  }));
  return data.Items || [];
}

module.exports.connect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const username = event.queryStringParameters?.username || 'Anonymous';
  const roomName = event.queryStringParameters?.room || 'General';

  console.log(`User ${username} connected to ${roomName} (${connectionId})`);

  try {
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: { connectionId, username, roomName }
    }));
  } catch (err) {
    console.error('Error adding connection:', err);
    return { statusCode: 500, body: 'Failed to connect' };
  }
  return success;
};

module.exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log(`Client disconnected: ${connectionId}`);

  try {
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
  } catch (err) {
    console.error('Error removing connection:', err);
  }
  return success;
};

module.exports.defaultMessage = async (event) => {
  return success;
};

module.exports.sendMessage = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) { return { statusCode: 400 }; }

  const apigw = getApiGatewayClient(event);
  
  // Save message to DB
  const messageItem = {
    roomName: body.roomName || 'General',
    timestamp: Date.now(),
    messageId: body.id,
    senderId: body.senderId,
    username: body.username,
    text: body.text,
    timeString: body.timestamp
  };

  try {
    await docClient.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: messageItem
    }));
  } catch (err) {
    console.error('Error saving message:', err);
  }

  // Broadcast to room
  const connections = await getRoomConnections(messageItem.roomName);
  
  const broadcastPayload = JSON.stringify({
    action: 'receiveMessage',
    ...messageItem
  });

  await Promise.all(connections.map(async ({ connectionId }) => {
    try {
      await apigw.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(broadcastPayload)
      }));
    } catch (e) {
      if (e.statusCode === 410 || e.$metadata?.httpStatusCode === 410) {
        await docClient.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
      }
    }
  }));

  // Phase 6: Basic AI Bot Integration
  if (body.text.toLowerCase().startsWith('@bot ')) {
    const query = body.text.substring(5).trim();
    // Simple mock response for now, can be replaced with real Gemini API call
    const botReply = `Hello ${body.username}! You asked: "${query}". (I am a mock AI bot. Real AI integration coming soon!)`;
    
    const botMessage = {
      roomName: messageItem.roomName,
      timestamp: Date.now() + 1,
      messageId: `bot-${Date.now()}`,
      senderId: 'bot',
      username: 'AI Assistant',
      text: botReply,
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await docClient.send(new PutCommand({ TableName: MESSAGES_TABLE, Item: botMessage }));
    const botPayload = JSON.stringify({ action: 'receiveMessage', ...botMessage });

    await Promise.all(connections.map(async ({ connectionId }) => {
      try {
        await apigw.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(botPayload) }));
      } catch (e) {}
    }));
  }

  return success;
};

module.exports.typing = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) { return { statusCode: 400 }; }

  const connections = await getRoomConnections(body.roomName);
  const apigw = getApiGatewayClient(event);
  
  const payload = JSON.stringify({
    action: 'typing',
    username: body.username
  });

  await Promise.all(connections.map(async ({ connectionId }) => {
    // Don't send typing indicator to the person who is typing
    if (connectionId !== event.requestContext.connectionId) {
      try {
        await apigw.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(payload)
        }));
      } catch (e) {
        if (e.statusCode === 410 || e.$metadata?.httpStatusCode === 410) {
          await docClient.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
        }
      }
    }
  }));
  return success;
};

module.exports.getRecentMessages = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) { return { statusCode: 400 }; }

  const roomName = body.roomName || 'General';
  const apigw = getApiGatewayClient(event);

  try {
    const data = await docClient.send(new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'roomName = :roomName',
      ExpressionAttributeValues: { ':roomName': roomName },
      ScanIndexForward: false, // get newest first
      Limit: 50
    }));

    // Reverse to send oldest first to client
    const messages = data.Items ? data.Items.reverse() : [];

    await apigw.send(new PostToConnectionCommand({
      ConnectionId: event.requestContext.connectionId,
      Data: Buffer.from(JSON.stringify({
        action: 'history',
        messages: messages
      }))
    }));
  } catch (err) {
    console.error('Error fetching history:', err);
  }

  return success;
};
