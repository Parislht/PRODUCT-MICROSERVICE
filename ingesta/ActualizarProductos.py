import json
import boto3
import urllib3
 
http = urllib3.PoolManager()
 
def deserialize(dynamo_json):
    data = {}
    for key, value in dynamo_json.items():
        data[key] = list(value.values())[0]
    return data 

def build_doc_id(item):
    # Construye ID combinando tenant_id y libro_id
    return f"{item['tenant_id']}-{item['libro_id']}"

def lambda_handler(event, context):
    print(event)
    for record in event['Records']:
        eventName = record['eventName']  # INSERT, MODIFY, REMOVE

        if eventName in ['INSERT', 'MODIFY']:
            print("Evento de insercion o modificación: ")
            new_image = record['dynamodb']['NewImage']
            print("Imagen nueva es: ")
            print(new_image)
            data = deserialize(new_image)
            doc_id = build_doc_id(data)
            print("doc_id es: ")
            print(doc_id)
            
            url = f"http://107.23.187.123:9100/libros/_doc/{doc_id}" #IP PUBLICA DE MV BUSQUEDA
            payload = json.dumps(data)
            print("Payload es: ")
            print(payload)
            headers = {"Content-Type": "application/json"}

            try:
               response = http.request("PUT", url, body=payload, headers=headers)
               print(f"PUT {url} -> {response.status} {response.data}")
            except Exception as e:
               print(f"Error al hacer PUT: {e}")

        elif eventName == 'REMOVE':
            print("Evento de eliminacion: ")
            old_keys = record['dynamodb']['Keys']
            data = deserialize(old_keys)
            doc_id = build_doc_id(data)

            url = f"http://107.23.187.123:9100/libros/_doc/{doc_id}"
            try:
                response = http.request("DELETE", url)
                print(f"DELETE {url} -> {response.status} {response.data}")
            except Exception as e:
                print(f"Error al hacer DELETE: {e}")

    return {
        'statusCode': 200,
        'body': json.dumps('Proceso de actualización completado')
    }
