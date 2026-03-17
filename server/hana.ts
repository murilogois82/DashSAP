import { createConnection } from '@sap/hana-client';
import { ENV } from './_core/env';

let _hanaConnection: any = null;

export async function getHanaConnection() {
  if (!_hanaConnection) {
    try {
      _hanaConnection = createConnection();
      _hanaConnection.connect({
        serverNode: `${ENV.hanaHost}:${ENV.hanaPort}`,
        uid: ENV.hanaUser,
        pwd: ENV.hanaPassword,
        // encrypt: 'true', // Uncomment if SSL/TLS is required
        // sslValidateCertificate: 'false', // Uncomment if self-signed certs are used
      });
      console.log('[HANA] Conexão estabelecida com sucesso.');
    } catch (error) {
      console.error('[HANA] Erro ao conectar ao SAP HANA:', error);
      _hanaConnection = null;
      throw error;
    }
  }
  return _hanaConnection;
}

export async function executeHanaQuery(query: string): Promise<any[]> {
  const connection = await getHanaConnection();
  return new Promise((resolve, reject) => {
    connection.exec(query, (err: any, result: any[]) => {
      if (err) {
        console.error('[HANA] Erro ao executar query:', err);
        return reject(err);
      }
      resolve(result);
    });
  });
}

export async function disconnectHana() {
  if (_hanaConnection) {
    _hanaConnection.disconnect((err: any) => {
      if (err) {
        console.error('[HANA] Erro ao desconectar do SAP HANA:', err);
      } else {
        console.log('[HANA] Conexão encerrada.');
      }
      _hanaConnection = null;
    });
  }
}
