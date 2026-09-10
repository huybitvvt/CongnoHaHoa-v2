import assert from 'node:assert/strict';
import test from 'node:test';
import { syncSpeegoOrders } from '../lib/server/speego-sync.ts';

const ENVIRONMENT_NAMES = [
  'SPEEGO_SOURCE_SUPABASE_URL',
  'SPEEGO_SOURCE_SUPABASE_KEY',
  'SPEEGO_SYNC_FROM',
  'SPEEGO_SYNC_BEFORE',
  'SPEEDGO_SOURCE_FIREBASE_API_KEY',
  'SPEEDGO_SOURCE_FIREBASE_PROJECT_ID',
  'SPEEDGO_SOURCE_EMAIL',
  'SPEEDGO_SOURCE_PASSWORD',
];

function firestoreString(value) {
  return { stringValue: value };
}

function firestoreInteger(value) {
  return { integerValue: String(value) };
}

function firestoreMap(fields) {
  return { mapValue: { fields } };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function destinationClient(existing = []) {
  const inserts = [];
  const updates = [];
  const client = {
    from(table) {
      assert.equal(table, 'speego');
      const selectChain = {
        order() { return selectChain; },
        async range() { return { data: existing, error: null }; },
      };
      return {
        select() { return selectChain; },
        async insert(rows) { inserts.push(...rows); return { error: null }; },
        async upsert(rows) { updates.push(...rows); return { error: null }; },
      };
    },
  };
  return { client, inserts, updates };
}

function configureEnvironment() {
  process.env.SPEEGO_SOURCE_SUPABASE_URL = 'https://source.example.test';
  process.env.SPEEGO_SOURCE_SUPABASE_KEY = 'source-read-only-test-key';
  process.env.SPEEGO_SYNC_FROM = '2026-09-01';
  process.env.SPEEGO_SYNC_BEFORE = '2026-10-01';
  process.env.SPEEDGO_SOURCE_FIREBASE_API_KEY = 'firebase-public-test-key';
  process.env.SPEEDGO_SOURCE_FIREBASE_PROJECT_ID = 'speedgo-os';
  process.env.SPEEDGO_SOURCE_EMAIL = 'admin@example.test';
  process.env.SPEEDGO_SOURCE_PASSWORD = 'test-password';
}

test('syncs Supabase and SpeedGo Firestore orders using read-only source requests', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = Object.fromEntries(ENVIRONMENT_NAMES.map((name) => [name, process.env[name]]));
  const sourceMethods = [];
  configureEnvironment();
  const createdAt = Date.parse('2026-09-05T08:30:00+07:00');
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    const method = init.method || 'GET';
    sourceMethods.push([address, method]);
    if (address.startsWith('https://source.example.test/rest/v1/orders?')) {
      return jsonResponse([{
        id: 'supabase-1', order_code: 'SUP-1', order_date: '2026-09-02',
        customer_name: 'Supabase customer', customer_phone: '0900000000', customer_address: 'Address 1',
        city: 'City', state: 'State', zipcode: '10000', country: 'US', tracking_code: '1ZAAAAA11111111111',
        marketing_staff: null, sale_staff: 'Sale A', cskh: null, delivery_staff: 'Delivery A',
        shipping_unit: 'UPS', sale_price: 125, payment_currency: 'USD', exchange_rate: null,
        total_amount_vnd: null, updated_at: '2026-09-02T00:00:00Z',
      }]);
    }
    if (address.startsWith('https://identitytoolkit.googleapis.com/')) {
      return jsonResponse({ idToken: 'test-id-token' });
    }
    if (address.includes('/documents/orders?')) {
      return jsonResponse({ documents: [{
        name: 'projects/speedgo-os/databases/(default)/documents/orders/firestore-1',
        fields: {
          orderId: firestoreString('SG-1'),
          createdAt: firestoreInteger(createdAt),
          updatedAt: firestoreInteger(createdAt + 1_000),
          amountTotal: firestoreInteger(15_000),
          currency: firestoreString('usd'),
          sellerId: firestoreString('seller-1'),
          createdByName: firestoreString('Operator A'),
          orderDetails: firestoreMap({
            customerName: firestoreString('Firestore customer'),
            phone: firestoreString('0911111111'),
            customerEmail: firestoreString('buyer@example.test'),
            shippingAddress: firestoreMap({
              line1: firestoreString('Address 2'), city: firestoreString('Other City'),
              state: firestoreString('CA'), postalCode: firestoreString('90001'), country: firestoreString('US'),
            }),
          }),
          fulfillment: firestoreMap({
            carrier: firestoreString('UPS'),
            trackingNumber: firestoreString('1ZBBBBB22222222222'),
          }),
        },
      }, {
        name: 'projects/speedgo-os/databases/(default)/documents/orders/firestore-2',
        fields: {
          orderId: firestoreString('SG-2'),
          createdAt: firestoreInteger(createdAt),
          updatedAt: firestoreInteger(createdAt + 2_000),
          amountTotal: firestoreInteger(16_000),
          currency: firestoreString('usd'),
          sellerId: firestoreString('seller-1'),
          createdByName: firestoreString('Operator A'),
          orderDetails: firestoreMap({
            customerName: firestoreString('Newer Firestore customer'),
            phone: firestoreString('0922222222'),
            customerEmail: firestoreString('newer@example.test'),
            shippingAddress: firestoreMap({ line1: firestoreString('Newer address') }),
          }),
          fulfillment: firestoreMap({
            carrier: firestoreString('UPS'),
            trackingNumber: firestoreString('1ZBBBBB22222222222'),
          }),
        },
      }] });
    }
    if (address.includes('/documents/users?')) {
      return jsonResponse({ documents: [{
        name: 'projects/speedgo-os/databases/(default)/documents/users/seller-1',
        fields: { shopName: firestoreString('Shop A'), fullName: firestoreString('Seller A') },
      }] });
    }
    throw new Error(`Unexpected request: ${method} ${address}`);
  };

  try {
    const destination = destinationClient();
    const result = await syncSpeegoOrders(destination.client);
    assert.deepEqual(result, {
      from: '2026-09-01', before: '2026-10-01', sourceRows: 2,
      supabaseRows: 1, speedGoRows: 2, speedGoTrackingRows: 1, inserted: 2, updated: 0,
    });
    assert.equal(destination.inserts.length, 2);
    const speedGo = destination.inserts.find((row) => row.tracking_code === '1ZBBBBB22222222222');
    assert.equal(speedGo.source_order_id, 'speedgo-firestore:firestore-2');
    assert.equal(speedGo.customer_name, 'Newer Firestore customer');
    assert.equal(speedGo.email, 'newer@example.test');
    assert.equal(speedGo.address, 'Newer address');
    assert.equal(speedGo.sales_person, 'Shop A · Seller A');
    assert.equal(speedGo.delivery_person, 'Operator A');
    assert.equal(speedGo.amount, 160);
    assert.equal(speedGo.unit_price, 160);
    assert.equal(speedGo.currency, 'USD');
    assert.equal(speedGo.source_updated_at, new Date(createdAt + 2_000).toISOString());
    assert.deepEqual(sourceMethods.map(([, method]) => method).sort(), ['GET', 'GET', 'GET', 'POST']);
    assert.equal(sourceMethods.filter(([address]) => address.includes('firestore.googleapis.com'))
      .every(([, method]) => method === 'GET'), true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ENVIRONMENT_NAMES) {
      if (originalEnvironment[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnvironment[name];
    }
  }
});
