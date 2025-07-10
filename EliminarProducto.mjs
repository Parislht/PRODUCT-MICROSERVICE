import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const lambdaClient = new LambdaClient();
const dynamoClient = new DynamoDBClient();

export const handler = async (event) => {
    console.log("========== INICIO DE ELIMINARPRODUCTO ==========");
    console.log("Evento recibido:", JSON.stringify(event));

    try {
        const producto = JSON.parse(event.body);
        console.log("Producto parseado del body:", JSON.stringify(producto));

        const token = event.headers['Authorization'];
        console.log("TOKEN RECIBIDO EN HEADER:", token);

        // Validar el token
        const payload = JSON.stringify({
            body: JSON.stringify({
                tenant_id: producto.tenant_id,
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

        // Verificar existencia del producto
        const getParams = new GetItemCommand({
            TableName: process.env.TABLE_NAME_PRODUCTS, 
            Key: {
                tenant_id: { S: producto.tenant_id },
                libro_id: { S: producto.libro_id }
            }
        });

        console.log("Parámetros para GetItem:", JSON.stringify(getParams));

        const getResult = await dynamoClient.send(getParams);
        console.log("Resultado GetItem:", JSON.stringify(getResult));

        if (!getResult.Item) {
            console.log("Producto no encontrado, abortando con 404.");
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Producto no encontrado"
                })
            };
        }

        // Eliminar el producto
        const deleteParams = new DeleteItemCommand({
            TableName: process.env.TABLE_NAME_PRODUCTS, 
            Key: {
                tenant_id: { S: producto.tenant_id },
                libro_id: { S: producto.libro_id }
            }
        });

        console.log("Parámetros para DeleteItem en DynamoDB:", JSON.stringify(deleteParams));

        await dynamoClient.send(deleteParams);
        console.log("Producto eliminado exitosamente de DynamoDB.");

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Producto eliminado exitosamente",
                producto
            })
        };

    } catch (err) {
        console.error("🚨 ERROR en EliminarProducto:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "No se pudo eliminar el producto"
            })
        };
    }
};
