import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const lambdaClient = new LambdaClient();
const dynamoClient = new DynamoDBClient();

export const handler = async (event) => {
    console.log("========== INICIO DE BUSCARPRODUCTO ==========");
    console.log("Evento recibido:", JSON.stringify(event));

    try {
        // Leer parámetros del query string
        const params = event.queryStringParameters || {};
        const tenant_id = params.tenant_id;
        const libro_id = params.libro_id;

        console.log("tenant_id recibido:", tenant_id);
        console.log("libro_id recibido:", libro_id);

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
            FunctionName: "ValidarTokenAcceso-proyecto-prueba",//CAMBIAR NOMBRE DE LAMBDA
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

        // Buscar el producto en DynamoDB
        const getParams = new GetItemCommand({
            TableName: "t_libro_proyecto_prueba", //CAMBIAR NOMBRE DE TABLA 
            Key: {
                tenant_id: { S: tenant_id },
                libro_id: { S: libro_id }
            }
        });

        console.log("Parámetros para GetItem:", JSON.stringify(getParams));

        const getResult = await dynamoClient.send(getParams);
        console.log("Resultado GetItem:", JSON.stringify(getResult));

        if (!getResult.Item) {
            console.log("Producto no encontrado, retornando 404.");
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Producto no encontrado"
                })
            };
        }

        // Preparar el producto para devolverlo limpio
        const item = getResult.Item;
        const producto = {
            tenant_id: item.tenant_id.S,
            libro_id: item.libro_id.S,
            titulo: item.titulo?.S,
            autor: item.autor?.S,
            precio: item.precio ? Number(item.precio.N) : null,
            stock: item.stock ? Number(item.stock.N) : null,
            descripcion: item.descripcion?.S
        };

        console.log("Producto encontrado:", JSON.stringify(producto));

        return {
            statusCode: 200,
            body: JSON.stringify(producto)
        };

    } catch (err) {
        console.error("ERROR en BuscarProducto:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "No se pudo buscar el producto"
            })
        };
    }
};
