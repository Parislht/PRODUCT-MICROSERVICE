import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const lambdaClient = new LambdaClient();
const dynamoClient = new DynamoDBClient();

export const handler = async (event) => {
    console.log("Evento recibido:", JSON.stringify(event));

    try {
        const params = event.queryStringParameters || {};
        const tenant_id = params.tenant_id;
        const startKey = params.startKey;  // es el libro_id

        console.log("tenant_id recibido:", tenant_id);
        console.log("startKey recibido:", startKey);

        const token = event.headers['Authorization'];
        console.log("TOKEN RECIBIDO EN HEADER:", token);

        // Validar el token
        const payload = JSON.stringify({
            body: JSON.stringify({
                tenant_id: tenant_id,
                token: token
            })
        });

        console.log("Payload que se enviará a ValidarTokenAcceso:", payload);

        const invokeParams = new InvokeCommand({
            FunctionName: process.env.VALIDAR_TOKEN_FUNC, 
            InvocationType: "RequestResponse",
            Payload: Buffer.from(payload)
        });

        const invokeResult = await lambdaClient.send(invokeParams);
        const responsePayload = JSON.parse(Buffer.from(invokeResult.Payload).toString());
        console.log("Respuesta de ValidarTokenAcceso:", JSON.stringify(responsePayload));

        if (responsePayload.statusCode === 403) {
            console.log("Token inválido, terminando ejecución con 403.");
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden - Acceso No Autorizado" })
            };
        }

        // Query a DynamoDB con paginado
        const queryParams = {
          TableName: process.env.TABLE_NAME_PRODUCTS,
          KeyConditionExpression: "tenant_id = :t",
          ExpressionAttributeValues: {
              ":t": { S: tenant_id }
          },
          Limit: 10
          };

        if (startKey) {
            queryParams.ExclusiveStartKey = {
                tenant_id: { S: tenant_id },
                libro_id: { S: startKey }
            };
            console.log("Se usará paginación con ExclusiveStartKey:", JSON.stringify(queryParams.ExclusiveStartKey));
        }

        console.log("Parámetros para QueryCommand:", JSON.stringify(queryParams));

        const queryResult = await dynamoClient.send(new QueryCommand(queryParams));
        console.log("Resultado del QueryCommand:", JSON.stringify(queryResult));

        // Preparar respuesta con productos + lastKey si existe
        const productos = queryResult.Items.map(item => {
            return {
                tenant_id: item.tenant_id.S,
                libro_id: item.libro_id.S,
                titulo: item.titulo?.S,
                autor: item.autor?.S,
                precio: item.precio ? Number(item.precio.N) : null,
                stock: item.stock ? Number(item.stock.N) : null,
                descripcion: item.descripcion?.S
            };
        });

        const response = {
            productos
        };

        if (queryResult.LastEvaluatedKey) {
            response.lastKey = {
                tenant_id: queryResult.LastEvaluatedKey.tenant_id.S,
                libro_id: queryResult.LastEvaluatedKey.libro_id.S
            };
            console.log("Último evaluated key para próxima página:", JSON.stringify(response.lastKey));
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };

    } catch (err) {
        console.error("ERROR en ListarProductos:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "No se pudo listar productos"
            })
        };
    }
};
