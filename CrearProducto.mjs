import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const lambdaClient = new LambdaClient();
const dynamoClient = new DynamoDBClient();

export const handler = async (event) => {
  
    console.log("Evento recibido:", JSON.stringify(event));

    const producto = JSON.parse(event.body);
    const token = event.headers['Authorization'];

    //DEBUG
    console.log("TOKEN RECIBIDO EN HEADER:", token);
    console.log("PRODUCTO RECIBIDO:", producto);


    //Validar token
    //Se llama con tenant_id y token
    const payload = JSON.stringify({
        body: JSON.stringify({
            tenant_id: producto.tenant_id,
            token: token
        })
    });

    console.log("Payload que se enviará a ValidarTokenAcceso:", payload);

    const invokeParams = new InvokeCommand({
        FunctionName: "ValidarTokenAcceso-proyecto-prueba", //<----NOMBRE A CAMBIAR SEGUN NOMBRE DE LAMBDA OFICIAL
        InvocationType: "RequestResponse",
        Payload: Buffer.from(payload)
    });


    const invokeResult = await lambdaClient.send(invokeParams);
    const responsePayload = JSON.parse(Buffer.from(invokeResult.Payload).toString());
    console.log("Respuesta de ValidarTokenAcceso:", JSON.stringify(responsePayload));

    if (responsePayload.statusCode === 403) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: "Forbidden - Acceso No Autorizado" })
        };
    }

    // Guardar producto en DynamoDB
    const putParams = new PutItemCommand({
        TableName: "t_libro_proyecto_prueba", //<---- NOMBRE A CAMBIAR SEGUN NOMBRE DE TABLA OFICIAL
        Item: {
            tenant_id: { S: producto.tenant_id },
            libro_id: { S: producto.libro_id },
            titulo: { S: producto.titulo },
            autor: { S: producto.autor },
            precio: { N: producto.precio.toString() },
            stock: { N: producto.stock.toString() },
            descripcion: { S: producto.descripcion }
        }
    }); 
  
    await dynamoClient.send(putParams);
    console.log("Producto guardado en DynamoDB");

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Producto creado exitosamente",
            producto
        })
    };
};
