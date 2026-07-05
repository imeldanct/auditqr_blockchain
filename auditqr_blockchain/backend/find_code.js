const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
env.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx === -1 || line.startsWith('#')) return;
  const key = line.slice(0, idx).trim();
  const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  process.env[key] = val;
});

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.parentQRCode.findMany({
  where: { currentStage: 'transit' },
  include: {
    product: true,
    scanEvents: {
      where: { scannerRole: 'transporter' },
      include: { handoffCode: true },
      orderBy: { timestamp: 'desc' },
      take: 1,
    },
  },
}).then(batches => {
  console.log('Batches in transit:', batches.length);
  batches.forEach(b => {
    const scan = b.scanEvents[0];
    console.log('Product:', b.product.productName);
    console.log('parentQRID:', b.parentQRID);
    console.log('Transporter scan ID:', scan?.scanID);
    console.log('Handoff code:', scan?.handoffCode?.codeValue ?? 'NOT GENERATED');
    console.log('---');
  });
  p.$disconnect();
}).catch(err => {
  console.error('DB error:', err.message);
  p.$disconnect();
});
