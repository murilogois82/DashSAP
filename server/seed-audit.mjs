/**
 * Seed script: Populates audit_logs with realistic SAP B1 HANA audit data.
 * Run: node server/seed-audit.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const MODULES = [
  { module: "Vendas", routines: ["Pedido de Venda", "Fatura de Saída", "Devolução de Venda", "Entrega"], objTypes: ["17", "13", "16", "15"], table: "ADOC" },
  { module: "Compras", routines: ["Pedido de Compra", "Fatura de Entrada", "Devolução de Compra", "Recebimento de Mercadoria"], objTypes: ["22", "18", "21", "20"], table: "ADOC" },
  { module: "Parceiros de Negócios", routines: ["Cliente", "Fornecedor", "Lead"], objTypes: ["2", "2", "2"], table: "ACRD" },
  { module: "Estoque", routines: ["Cadastro de Item", "Grupo de Itens"], objTypes: ["4", "52"], table: "AITM" },
  { module: "Pagamentos", routines: ["Pagamento Recebido", "Pagamento Recebido - Cheque"], objTypes: ["24", "24"], table: "ARCT" },
  { module: "Produção", routines: ["Ordem de Produção"], objTypes: ["202"], table: "AWOR" },
  { module: "Finanças", routines: ["Lançamento Contábil Manual", "Lançamento Contábil"], objTypes: ["30", "30"], table: "AJDT" },
];

const USERS = ["manager", "vendas01", "compras01", "financeiro01", "estoque01", "admin", "supervisor"];
const PROCEDURES = ["Inclusão", "Alteração", "Exclusão"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function padDate(d) { return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
function padTime(d) { return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; }

function generateContent(mod, routine, proc) {
  const docNum = rand(10000, 99999);
  switch (mod.table) {
    case "ADOC": {
      const total = (rand(100, 50000) + rand(0, 99) / 100).toFixed(2);
      const cardCode = `C${rand(10000, 99999)}`;
      const cardName = pick(["Empresa Alpha Ltda", "Beta Comércio SA", "Gamma Indústria", "Delta Serviços", "Omega Trading", "Sigma Corp", "Zeta Distribuidora"]);
      if (proc === "Inclusão") return { prev: null, curr: `DocNum: ${docNum} | Total: R$ ${total} | PN: ${cardCode} - ${cardName}` };
      const oldTotal = (parseFloat(total) * (1 + (rand(-20, 20) / 100))).toFixed(2);
      return { prev: `DocNum: ${docNum} | Total: R$ ${oldTotal} | PN: ${cardCode} - ${cardName}`, curr: `DocNum: ${docNum} | Total: R$ ${total} | PN: ${cardCode} - ${cardName}` };
    }
    case "ACRD": {
      const cardCode = `C${rand(10000, 99999)}`;
      const names = ["Empresa Alpha Ltda", "Beta Comércio SA", "Gamma Indústria", "Delta Serviços", "Omega Trading"];
      const name = pick(names);
      const group = pick(["Clientes Nacionais", "Clientes Internacionais", "Fornecedores Nacionais", "Leads"]);
      const balance = (rand(0, 500000) + rand(0, 99) / 100).toFixed(2);
      if (proc === "Inclusão") return { prev: null, curr: `Código: ${cardCode} | Nome: ${name} | Grupo: ${group} | Saldo: R$ ${balance}` };
      const oldBalance = (parseFloat(balance) * (1 + (rand(-30, 30) / 100))).toFixed(2);
      const oldGroup = pick(["Clientes Nacionais", "Clientes Internacionais", "Fornecedores Nacionais"]);
      return { prev: `Código: ${cardCode} | Nome: ${name} | Grupo: ${oldGroup} | Saldo: R$ ${oldBalance}`, curr: `Código: ${cardCode} | Nome: ${name} | Grupo: ${group} | Saldo: R$ ${balance}` };
    }
    case "AITM": {
      const itemCode = `IT${rand(1000, 9999)}`;
      const itemNames = ["Parafuso M8x30", "Placa de Aço 2mm", "Motor Elétrico 5CV", "Rolamento 6205", "Correia Dentada GT2", "Sensor de Temperatura", "Válvula Solenoide"];
      const itemName = pick(itemNames);
      const grpCode = pick(["Matéria Prima", "Produto Acabado", "Componentes", "Embalagens"]);
      const price = (rand(5, 5000) + rand(0, 99) / 100).toFixed(2);
      if (proc === "Inclusão") return { prev: null, curr: `Item: ${itemCode} | Nome: ${itemName} | Grupo: ${grpCode} | Preço: R$ ${price}` };
      const oldPrice = (parseFloat(price) * (1 + (rand(-25, 25) / 100))).toFixed(2);
      return { prev: `Item: ${itemCode} | Nome: ${itemName} | Grupo: ${grpCode} | Preço: R$ ${oldPrice}`, curr: `Item: ${itemCode} | Nome: ${itemName} | Grupo: ${grpCode} | Preço: R$ ${price}` };
    }
    case "ARCT": {
      const total = (rand(500, 100000) + rand(0, 99) / 100).toFixed(2);
      const cardCode = `C${rand(10000, 99999)}`;
      if (proc === "Inclusão") return { prev: null, curr: `DocNum: ${docNum} | Valor: R$ ${total} | PN: ${cardCode}` };
      const oldTotal = (parseFloat(total) * (1 + (rand(-15, 15) / 100))).toFixed(2);
      return { prev: `DocNum: ${docNum} | Valor: R$ ${oldTotal} | PN: ${cardCode}`, curr: `DocNum: ${docNum} | Valor: R$ ${total} | PN: ${cardCode}` };
    }
    case "AWOR": {
      const qty = rand(10, 5000);
      const itemCode = `IT${rand(1000, 9999)}`;
      const status = pick(["Planejada", "Liberada", "Encerrada"]);
      if (proc === "Inclusão") return { prev: null, curr: `DocNum: ${docNum} | Item: ${itemCode} | Qtd: ${qty} | Status: ${status}` };
      const oldQty = rand(10, 5000);
      const oldStatus = pick(["Planejada", "Liberada"]);
      return { prev: `DocNum: ${docNum} | Item: ${itemCode} | Qtd: ${oldQty} | Status: ${oldStatus}`, curr: `DocNum: ${docNum} | Item: ${itemCode} | Qtd: ${qty} | Status: ${status}` };
    }
    case "AJDT": {
      const total = (rand(100, 200000) + rand(0, 99) / 100).toFixed(2);
      const account = `${rand(1, 9)}.${rand(1, 9)}.${rand(1, 9)}.${rand(10, 99)}`;
      const memo = pick(["Provisão mensal", "Ajuste de estoque", "Depreciação", "Receita financeira", "Despesa operacional"]);
      if (proc === "Inclusão") return { prev: null, curr: `TransId: ${docNum} | Conta: ${account} | Valor: R$ ${total} | Memo: ${memo}` };
      const oldTotal = (parseFloat(total) * (1 + (rand(-20, 20) / 100))).toFixed(2);
      return { prev: `TransId: ${docNum} | Conta: ${account} | Valor: R$ ${oldTotal} | Memo: ${memo}`, curr: `TransId: ${docNum} | Conta: ${account} | Valor: R$ ${total} | Memo: ${memo}` };
    }
    default:
      return { prev: null, curr: `DocNum: ${docNum}` };
  }
}

async function seed() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("Connected. Seeding audit_logs...");

  // Clear existing data
  await conn.execute("DELETE FROM audit_logs");

  const rows = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = padDate(date);
    const numEntries = rand(5, 30);

    for (let i = 0; i < numEntries; i++) {
      const mod = pick(MODULES);
      const routineIdx = rand(0, mod.routines.length - 1);
      const routine = mod.routines[routineIdx];
      const objType = mod.objTypes[routineIdx];
      const user = pick(USERS);
      const proc = pick(PROCEDURES);
      const logInst = proc === "Inclusão" ? 0 : rand(1, 20);
      const time = new Date(date);
      time.setHours(rand(7, 19), rand(0, 59), rand(0, 59));
      const content = generateContent(mod, routine, proc);

      rows.push([
        dateStr,
        padTime(time),
        proc,
        mod.module,
        routine,
        objType,
        user,
        String(rand(10000, 99999)),
        logInst,
        content.prev,
        content.curr,
        mod.table,
      ]);
    }
  }

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const flat = batch.flat();
    await conn.execute(
      `INSERT INTO audit_logs (changeDate, changeTime, procedureType, module, routine, objType, sapUser, docNum, logInstance, previousContent, currentContent, sourceTable) VALUES ${placeholders}`,
      flat
    );
  }

  console.log(`Seeded ${rows.length} audit log entries.`);
  await conn.end();
}

seed().catch(console.error);
