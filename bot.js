const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const qrcode = require("qrcode-terminal")
const fs = require("fs")

// ================= CONFIG =================
const GROUP_ID = "120363385410561546@g.us"
const SESSION_FOLDER = "./auth"
const DATA_FILE = "./data.json"

let lastMessageId = null
let sock = null
let reconnectTimeout = null

// ================= LOAD DATA =================
function loadData() {
  try {
      if (!fs.existsSync(DATA_FILE)) {
          return {
              UK: {},
              CELENGAN: {},
              PENCAIRAN: {},
              BTC: {},
              PARSIAL: {},
              SOS: {}
          }
      }
      return JSON.parse(fs.readFileSync(DATA_FILE))
  } catch {
      return {
          UK: {},
          CELENGAN: {},
          PENCAIRAN: {},
          BTC: {},
          PARSIAL: {},
          SOS: {}
      }
  }
}

// ================= SAVE DATA =================
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// ================= RESET DATA =================
function resetData() {
  const empty = {
      UK: {},
      CELENGAN: {},
      PENCAIRAN: {},
      BTC: {},
      PARSIAL: {},
      SOS: {}
  }
  saveData(empty)
  return empty
}

// ================= FORMAT RUPIAH =================
function rupiah(angka) {
  return "Rp " + Number(angka || 0).toLocaleString("id-ID")
}

// ================= FORMAT WAKTU =================
function waktu() {
  return new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour12: false
  }) + " WIB"
}

// ================= FORMAT LAPORAN =================
function formatLaporan(data) {

  let totalCelengan = 0
  let totalPencairan = 0
  let totalBTC = 0
  let totalParsial = 0

  let msg = ""
  msg += "📊 REPORT KMO\n"
  msg += "🕒 " + waktu() + "\n\n"

  // UK
  msg += "👥 UK\n"
  for (let sales in data.UK) {
      msg += sales + "\n"
      data.UK[sales].forEach(x=>{
          msg += "• " + x.nama + " — " + x.status + "\n"
      })
  }

  msg += "\n"

  // CELENGAN
  msg += "💰 CELENGAN\n"
  for (let sales in data.CELENGAN) {
      msg += sales + "\n"
      data.CELENGAN[sales].forEach(x=>{
          totalCelengan += Number(x.nominal)
          msg += "• " + x.nama + " — " + rupiah(x.nominal) + "\n"
      })
  }
  msg += "Total : " + rupiah(totalCelengan) + "\n\n"

  // PENCAIRAN
  msg += "🏦 PENCAIRAN\n"
  for (let sales in data.PENCAIRAN) {
      msg += sales + "\n"
      data.PENCAIRAN[sales].forEach(x=>{
          totalPencairan += Number(x.nominal)
          msg += "• " + x.nama + " — " + rupiah(x.nominal) + "\n"
      })
  }
  msg += "Total : " + rupiah(totalPencairan) + "\n\n"

  // BTC
  msg += "📈 BTC\n"
  for (let sales in data.BTC) {
      msg += sales + "\n"
      data.BTC[sales].forEach(x=>{
          totalBTC += Number(x.nominal)
          msg += "• " + x.nama + " — " + rupiah(x.nominal) + "\n"
      })
  }
  msg += "Total : " + rupiah(totalBTC) + "\n\n"

  // PARSIAL
  msg += "📉 PARSIAL\n"
  for (let sales in data.PARSIAL) {
      msg += sales + "\n"
      data.PARSIAL[sales].forEach(x=>{
          totalParsial += Number(x.nominal)
          msg += "• " + x.nama + " — " + rupiah(x.nominal) + "\n"
      })
  }
  msg += "Total : " + rupiah(totalParsial) + "\n\n"

  // SOS
  msg += "⚠️ SOS\n"
  for (let sales in data.SOS) {
      msg += sales + "\n"
      data.SOS[sales].forEach(x=>{
          msg += "• " + x.nama + " — " + x.keterangan + "\n"
      })
  }

  msg += "\n📌 RINGKASAN\n"
  msg += "Celengan   : " + rupiah(totalCelengan) + "\n"
  msg += "Pencairan  : " + rupiah(totalPencairan) + "\n"
  msg += "BTC        : " + rupiah(totalBTC) + "\n"
  msg += "Parsial    : " + rupiah(totalParsial) + "\n\n"

  msg += "🤖 Auto Report Bot"

  return msg
}

// ================= TAMBAH DATA =================
function tambahData(kategori, sales, detail) {

  const data = loadData()

  if (!data[kategori]) data[kategori] = {}
  if (!data[kategori][sales]) data[kategori][sales] = []

  data[kategori][sales].push(detail)

  saveData(data)
}

// ================= PARSE =================
function parsePesan(text){

  const lines = text.split("\n").map(x=>x.trim())

  if(lines.length < 3) return null

  const kategori = lines[0].toUpperCase()
  const sales = lines[1]

  if(!["UK","CELENGAN","PENCAIRAN","BTC","PARSIAL","SOS"].includes(kategori))
      return null

  const hasil = []

  for(let i=2;i<lines.length;i++){

      const parts = lines[i].split(" - ")

      if(kategori=="UK"){

          hasil.push({
              nama: parts[0],
              status: parts[1] || "-"
          })

      }else if(kategori=="SOS"){

          hasil.push({
              nama: parts[0],
              keterangan: parts.slice(1).join(" - ")
          })

      }else{

          hasil.push({
              nama: parts[0],
              nominal: Number(parts[1]?.replace(/\./g,"").replace(/,/g,"")) || 0
          })

      }
  }

  return {kategori,sales,hasil}
}

// ================= CONNECT =================
async function connectBot(){

  const {state,saveCreds} =
  await useMultiFileAuthState(SESSION_FOLDER)

  const {version} =
  await fetchLatestBaileysVersion()

  sock =
  makeWASocket({
      version,
      auth: state,
      logger: pino({level:"silent"}),
      browser:["Ubuntu","Chrome","20.0.04"]
  })

  sock.ev.on("creds.update",saveCreds)

sock.ev.on("connection.update", ({ connection, qr }) => {

  if (qr) {
    console.log("QR RECEIVED");
    qrcode.generate(qr, { small: false });

    console.log(
      "Link QR:",
      "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + qr
    );
  }

  if (connection === "open") {
    console.log("BOT CONNECTED");
  }

      if(connection==="close"){

          const reason =
          lastDisconnect?.error?.output?.statusCode

          if(reason !== DisconnectReason.loggedOut){

              console.log("Reconnect 5s...")
              clearTimeout(reconnectTimeout)

              reconnectTimeout =
              setTimeout(connectBot,5000)

          }else{

              console.log("Session logout, scan ulang")

          }
      }

  })

  sock.ev.on("messages.upsert", async ({messages,type})=>{

      try{

          if(type!=="notify") return

          const msg = messages[0]

          if(!msg.message) return
          if(msg.key.fromMe) return
          if(msg.key.id===lastMessageId) return

          lastMessageId = msg.key.id

          const jid = msg.key.remoteJid

          if(jid!==GROUP_ID) return

          const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          ""

          if(!text) return

          if(text.toUpperCase()=="RESET DATA"){

              resetData()

              await sock.sendMessage(
                  GROUP_ID,
                  {text:"Data berhasil direset"}
              )

              return
          }

          const parsed = parsePesan(text)

          if(!parsed) return

          parsed.hasil.forEach(x=>{
              tambahData(parsed.kategori,parsed.sales,x)
          })

          const laporan =
          formatLaporan(loadData())

          await sock.sendMessage(
              GROUP_ID,
              {text:laporan}
          )

          console.log("Laporan terkirim")

      }catch(err){

          console.log("ERROR:",err.message)

      }

  })

}

// ================= START =================
connectBot()
