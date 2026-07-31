'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDataSource, resolveTextValue, resolveQrValue, resolveImageUrl } = require('../src/services/dataResolver');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

const labelData = labelDataByParticipantId['aaaaaaaa-0000-0000-0000-000000000001'];
const labelDataNoLogo = labelDataByParticipantId['aaaaaaaa-0000-0000-0000-000000000002'];

test('resolveDataSource reads participant/event/customField sources', () => {
  assert.equal(resolveDataSource('participant.name', labelData), 'Fulano de Tal Sintético');
  assert.equal(resolveDataSource('participant.category', labelData), 'Marketing');
  assert.equal(resolveDataSource('participant.id', labelData), 'aaaaaaaa-0000-0000-0000-000000000001');
  assert.equal(resolveDataSource('qr_code', labelData), 'aaaaaaaa-0000-0000-0000-000000000001');
  assert.equal(resolveDataSource('event.name', labelData), 'Evento Teste');
  assert.equal(resolveDataSource('event.venue', labelData), 'Centro de Convenções');
  assert.equal(resolveDataSource('event.city', labelData), 'São Paulo');
  assert.equal(resolveDataSource('event.state', labelData), 'SP');
  assert.equal(resolveDataSource('event.label_logo', labelData), labelData.event.label_logo);
  assert.equal(resolveDataSource('custom_field.91', labelData), 'Unidade Teste');
  assert.equal(resolveDataSource('custom_field.missing', labelData), undefined);
  assert.equal(resolveDataSource('unknown.thing', labelData), undefined);
  assert.equal(resolveDataSource('participant.name', null), undefined);
});

test('resolveTextValue falls back to fallbackValue when field is missing/blank', () => {
  const element = { dataSource: 'custom_field.999', fallbackValue: 'N/D' };
  assert.equal(resolveTextValue(element, labelData), 'N/D');
});

test('resolveTextValue uses staticValue for dataSource "static_text"', () => {
  const element = { dataSource: 'static_text', staticValue: 'Texto fixo', fallbackValue: 'N/D' };
  assert.equal(resolveTextValue(element, labelData), 'Texto fixo');
});

test('resolveTextValue normalizes internal whitespace and trims', () => {
  const element = { dataSource: 'participant.name', fallbackValue: '' };
  const noisy = { participant: { name: '  Fulano   de   Tal  ' }, event: {}, customFields: {} };
  assert.equal(resolveTextValue(element, noisy), 'Fulano de Tal');
});

test('resolveQrValue always returns participant.id, ignoring the element dataSource', () => {
  const element = { dataSource: 'qr_code' };
  assert.equal(resolveQrValue(element, labelData), 'aaaaaaaa-0000-0000-0000-000000000001');
  assert.equal(resolveQrValue(element, null), '');
});

test('resolveImageUrl returns null when the logo field is empty', () => {
  const element = { dataSource: 'event.label_logo' };
  assert.equal(resolveImageUrl(element, labelData), labelData.event.label_logo);
  assert.equal(resolveImageUrl(element, labelDataNoLogo), null);
});
