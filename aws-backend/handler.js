require('dotenv').config();

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  GetCommand,
  DynamoDBDocumentClient
} = require('@aws-sdk/lib-dynamodb');

const { ApiGatewayManagementApiClient, PostToConnectionCommand } =
  require('@aws-sdk/client-apigatewaymanagementapi');


const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IS_OFFLINE = true;

console.log("===== HANDLER LOADED =====");
console.log("CONNECTIONS_TABLE =", CONNECTIONS_TABLE);
console.log("MESSAGES_TABLE =", MESSAGES_TABLE);
console.log("GEMINI =", GEMINI_API_KEY ? "FOUND" : "MISSING");
console.log("IS_OFFLINE =", IS_OFFLINE);
console.log("TABLE =", CONNECTIONS_TABLE);

const dynamoDbClient = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:8000',
  credentials: {
    accessKeyId: 'DEFAULT',
    secretAccessKey: 'DEFAULT'
  }
});
console.log('Using LOCAL DynamoDB @ 127.0.0.1:8000');
console.log("DYNAMO ENDPOINT =", dynamoDbClient.config.endpoint);
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const success = { statusCode: 200, body: 'Success' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiGatewayClient(event) {

  if (IS_OFFLINE) {

    console.log('Using LOCAL ApiGatewayManagementApiClient');

    return new ApiGatewayManagementApiClient({
      endpoint: 'http://localhost:4001',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'LOCAL',
        secretAccessKey: 'LOCAL'
      }
    });
  }

  const endpoint =
    `https://${event.requestContext.domainName}/${event.requestContext.stage}`;

  return new ApiGatewayManagementApiClient({
    endpoint
  });
}

// Get all active connections in a specific room
async function getRoomConnections(roomName) {
  const data = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'roomName = :roomName',
    ExpressionAttributeValues: { ':roomName': roomName }
  }));
  return data.Items || [];
}

// Broadcast a JSON payload to a list of connections, removing stale ones
async function broadcast(apigw, connections, payload, excludeConnectionId = null) {
  const data = Buffer.from(JSON.stringify(payload));
  await Promise.all(
    connections
      .filter(c => c.connectionId !== excludeConnectionId)
      .map(async ({ connectionId }) => {
        try {
          await apigw.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
        } catch (e) {
          if (e.statusCode === 410 || e.$metadata?.httpStatusCode === 410) {
            await docClient.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
          } else {
            console.error(`[BROADCAST ERROR] failed for connectionId ${connectionId}:`, e);
          }
        }
      })
  );
}

// ─── $connect ────────────────────────────────────────────────────────────────

module.exports.connect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const username = event.queryStringParameters?.username || 'Anonymous';
  const roomName = event.queryStringParameters?.room || 'General';

  console.log(`[CONNECT] ${username} → ${roomName} (${connectionId})`);
  console.log('CONNECTIONS_TABLE env:', CONNECTIONS_TABLE, 'MESSAGES_TABLE env:', MESSAGES_TABLE);
  console.log("TABLE =", CONNECTIONS_TABLE);
  console.log("DYNAMO ENDPOINT =", dynamoDbClient.config.endpoint);
  try {
    // Save this connection to DynamoDB
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: { connectionId, username, roomName }
    }));
  } catch (err) {
    console.error('Error saving connection:', err);
    return { statusCode: 500, body: 'Failed to connect' };
  }

  // Fetch updated room connections and broadcast join notification + user list
  try {
    const apigw = getApiGatewayClient(event);
    const connections = await getRoomConnections(roomName);
    const userList = connections.map(c => c.username);

    // Notify everyone in the room (excluding the new joiner to avoid 410 deletion before handshake completes)
    await broadcast(apigw, connections, {
      action: 'userJoined',
      username,
      userList,
      message: `${username} joined the room`
    }, connectionId);
  } catch (err) {
    console.error('Error broadcasting join:', err);
  }

  return success;
};

// ─── $disconnect ─────────────────────────────────────────────────────────────

module.exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log(`[DISCONNECT] ${connectionId}`);

  // Fetch connection details BEFORE deleting so we can notify the room
  let username = 'Someone';
  let roomName = 'General';

  try {
    const result = await docClient.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
    if (result.Item) {
      username = result.Item.username;
      roomName = result.Item.roomName;
    }
  } catch (err) {
    console.error('Error fetching connection before delete:', err);
  }

  // Delete from DynamoDB
  try {
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
  } catch (err) {
    console.error('Error removing connection:', err);
  }

  // Broadcast leave notification + updated user list to the remaining users
  try {
    const apigw = getApiGatewayClient(event);
    const connections = await getRoomConnections(roomName); // already deleted above
    const userList = connections.map(c => c.username);

    await broadcast(apigw, connections, {
      action: 'userLeft',
      username,
      userList,
      message: `${username} left the room`
    });
  } catch (err) {
    console.error('Error broadcasting leave:', err);
  }

  return success;
};

// ─── $default ────────────────────────────────────────────────────────────────

module.exports.defaultMessage = async () => success;

// ─── sendMessage ─────────────────────────────────────────────────────────────

module.exports.sendMessage = async (event) => {
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const apigw = getApiGatewayClient(event);
  const roomName = body.roomName || 'General';

  // Build and save the message
  const messageItem = {
    roomName,
    timestamp: Date.now(),
    messageId: body.id || `msg-${Date.now()}`,
    senderId: body.senderId || body.username,
    username: body.username,
    text: body.text,
    timeString: body.timestamp
  };

  try {
    await docClient.send(new PutCommand({ TableName: MESSAGES_TABLE, Item: messageItem }));
  } catch (err) {
    console.error('Error saving message:', err);
  }

  // Broadcast message to entire room
  const connections = await getRoomConnections(roomName);

try {
  await broadcast(apigw, connections, {
    action: 'receiveMessage',
    ...messageItem
  });
} catch (err) {
  console.error('Broadcast failed:', err);
}

return {
  statusCode: 200,
  body: JSON.stringify({
    success: true,
    message: 'Message sent'
  })
};
};



// ─── typing ──────────────────────────────────────────────────────────────────

module.exports.typing = async (event) => {
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400 }; }

  const apigw = getApiGatewayClient(event);
  const connections = await getRoomConnections(body.roomName);

  // Send to everyone except the typer
  await broadcast(apigw, connections, { action: 'typing', username: body.username }, event.requestContext.connectionId);

  return success;
};

// ─── getRecentMessages ───────────────────────────────────────────────────────

module.exports.getRecentMessages = async (event) => {
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400 }; }

  const roomName = body.roomName || 'General';
  const apigw = getApiGatewayClient(event);

  try {
    const data = await docClient.send(new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'roomName = :roomName',
      ExpressionAttributeValues: { ':roomName': roomName },
      ScanIndexForward: false, // newest first
      Limit: 50
    }));

    // Reverse so client gets oldest → newest
    const messages = data.Items ? data.Items.reverse() : [];

    await apigw.send(new PostToConnectionCommand({
      ConnectionId: event.requestContext.connectionId,
      Data: Buffer.from(JSON.stringify({ action: 'history', messages }))
    }));

    // Send current online user list to the connecting client since they were excluded from the connect broadcast
    const connections = await getRoomConnections(roomName);
    const userList = connections.map(c => c.username);
    await apigw.send(new PostToConnectionCommand({
      ConnectionId: event.requestContext.connectionId,
      Data: Buffer.from(JSON.stringify({
        action: 'userJoined',
        username: 'System',
        userList,
        message: 'Welcome!'
      }))
    }));
  } catch (err) {
    console.error('Error fetching history:', err);
  }

  return success;
};
