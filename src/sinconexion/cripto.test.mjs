// Pruebas de la llave de la bóveda: importación, cifrado de ida y vuelta y llave equivocada.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ErrorDescifrado,
  ErrorLlave,
  base64urlDeBytes,
  bytesDeBase64url,
  cifrar,
  descifrar,
  descifrarJson,
  cifrarJson,
  importarLlave,
  sha256Hex,
} from './cripto.js'
import { llaveDePrueba, tokenConSid } from './ayudas-prueba.mjs'
import { cargaDeToken, sidDeToken } from './token.js'

test('base64url: ida y vuelta de 32 bytes y rechazo de basura', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 250) % 256)
  const texto = base64urlDeBytes(bytes)
  assert.equal(texto.length, 43)
  assert.doesNotMatch(texto, /[+/=]/)
  assert.deepEqual(bytesDeBase64url(texto), bytes)
  assert.throws(() => bytesDeBase64url('esto no es base64!'), ErrorLlave)
})

test('importarLlave: AES-GCM de 256 bits, NO extraíble y solo para cifrar/descifrar', async () => {
  const llave = await importarLlave(llaveDePrueba())
  assert.equal(llave.extractable, false)
  assert.equal(llave.algorithm.name, 'AES-GCM')
  assert.equal(llave.algorithm.length, 256)
  assert.deepEqual([...llave.usages].sort(), ['decrypt', 'encrypt'])
  // No se puede sacar de WebCrypto ni en bruto ni como JWK.
  await assert.rejects(globalThis.crypto.subtle.exportKey('raw', llave))
  await assert.rejects(globalThis.crypto.subtle.exportKey('jwk', llave))
})

test('importarLlave: una llave de longitud incorrecta o mal formada falla limpio', async () => {
  await assert.rejects(importarLlave(base64urlDeBytes(new Uint8Array(16))), ErrorLlave)
  await assert.rejects(importarLlave(base64urlDeBytes(new Uint8Array(33))), ErrorLlave)
  await assert.rejects(importarLlave(''), ErrorLlave)
  await assert.rejects(importarLlave(null), ErrorLlave)
  await assert.rejects(importarLlave('***'), ErrorLlave)
})

test('cifrar/descifrar: ida y vuelta con IV propio de 12 bytes en cada registro', async () => {
  const llave = await importarLlave(llaveDePrueba())
  const a = await cifrar(llave, 'mismo texto', 'cola:cuerpo')
  const b = await cifrar(llave, 'mismo texto', 'cola:cuerpo')
  assert.equal(a.iv.byteLength, 12)
  assert.notDeepEqual(a.iv, b.iv)
  assert.notDeepEqual(a.cifrado, b.cifrado)
  assert.equal(new TextDecoder().decode(await descifrar(llave, a, 'cola:cuerpo')), 'mismo texto')
  const bytes = Uint8Array.from([0, 1, 2, 250, 255])
  assert.deepEqual(await descifrar(llave, await cifrar(llave, bytes)), bytes)
  assert.deepEqual(await descifrarJson(llave, await cifrarJson(llave, { a: [1, 'ñ'] })), { a: [1, 'ñ'] })
})

test('llave equivocada, aad distinto o dato alterado: falla limpio con ErrorDescifrado', async () => {
  const llave = await importarLlave(llaveDePrueba(7))
  const otra = await importarLlave(llaveDePrueba(8))
  const registro = await cifrar(llave, 'secreto', 'copia:ultima')
  await assert.rejects(descifrar(otra, registro, 'copia:ultima'), ErrorDescifrado)
  await assert.rejects(descifrar(llave, registro, 'cola:cuerpo'), ErrorDescifrado)
  const alterado = { iv: registro.iv, cifrado: registro.cifrado.slice() }
  alterado.cifrado[0] ^= 1
  await assert.rejects(descifrar(llave, alterado, 'copia:ultima'), ErrorDescifrado)
})

test('sha256Hex: vector conocido', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
})

test('sid del token: se lee la parte central sin verificarla', () => {
  assert.equal(sidDeToken(tokenConSid('abc123')), 'abc123')
  assert.equal(cargaDeToken(tokenConSid('x')).aud, 'exp189-solicitante')
  assert.equal(sidDeToken('no-es-un-token'), null)
  assert.equal(sidDeToken(null), null)
  assert.equal(sidDeToken('a.@@@.c'), null)
})
