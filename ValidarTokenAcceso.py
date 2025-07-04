import os
import boto3
from datetime import datetime
import json
def lambda_handler(event, context):

    #DEBUG
    print("EVENTO: ")
    print(event)

    body = json.loads(event['body'])  
    tenant_id = body['tenant_id']
    token = body['token']  
    tabla_token = "t_tokens_acceso_proyecto_prueba" #os.environ['TABLE_TOKEN'] #CAMBIAR NOMBRE DE TABLA OFICIAL

    # Proceso
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(tabla_token)

    print("Se empieza a buscar el token" )

    response = table.get_item(
    Key={
        'tenant_id': tenant_id,
        'token': token
        }
    )

    #DEBUG
    print("Respuesta obtenida", response)
  
    if 'Item' not in response:
        print("token no existe")
        return {
            'statusCode': 403,
            'body': 'Token no existe'
        }
    else:
        expires = response['Item']['expires']
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if now > expires:
            print("token epirado")
            return {
                'statusCode': 403,
                'body': 'Token expirado'
            }

    # Salida (json)
    print("token correctamente validado")
    return {
        'statusCode': 200,
        'body': 'Token válido'
    }
