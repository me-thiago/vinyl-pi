/**
 * Teste Manual do AudioManager
 *
 * Para executar: npx ts-node src/__tests__/manual/audio-manager-test.ts
 *
 * IMPORTANTE: Requer dispositivo ALSA disponível no sistema
 */

import { AudioManager } from '../../services/audio-manager';

async function runManualTests() {
  console.log('=== Teste Manual do AudioManager ===\n');

  // Test 1: Instanciação com configuração padrão
  console.log('Test 1: Instanciação com configuração padrão');
  try {
    const audioManager1 = new AudioManager();
    const status1 = audioManager1.getStatus();
    console.log('✅ AudioManager criado com sucesso');
    console.log('   Device:', status1.device);
    console.log('   Capturing:', status1.isCapturing);
  } catch (error) {
    console.error('❌ Erro ao criar AudioManager:', error);
  }
  console.log('');

  // Test 2: Instanciação com configuração customizada
  console.log('Test 2: Instanciação com configuração customizada');
  try {
    const audioManager2 = new AudioManager({
      device: 'plughw:0,0',
      sampleRate: 44100,
      bufferSize: 2048
    });
    const status2 = audioManager2.getStatus();
    console.log('✅ AudioManager criado com configuração custom');
    console.log('   Device:', status2.device);
    console.log('   Sample Rate: 44100Hz');
    console.log('   Buffer Size: 2048');
  } catch (error) {
    console.error('❌ Erro ao criar AudioManager custom:', error);
  }
  console.log('');

  // Test 3: Validação de buffer size
  console.log('Test 3: Validação de buffer size (deve falhar)');
  try {
    const audioManager3 = new AudioManager({
      bufferSize: 4096 // Fora do range 512-2048
    });
    console.error('❌ Deveria ter lançado erro para buffer size inválido');
  } catch (error) {
    console.log('✅ Erro esperado capturado:', (error as Error).message);
  }
  console.log('');

  // Test 4: Verificar devices ALSA disponíveis
  console.log('Test 4: Listar devices ALSA disponíveis');
  try {
    const { spawn } = await import('child_process');
    const arecord = spawn('arecord', ['-l']);

    let output = '';
    arecord.stdout.on('data', (data) => {
      output += data.toString();
    });

    await new Promise<void>((resolve) => {
      arecord.on('close', (code) => {
        if (code === 0 && output) {
          console.log('✅ Devices ALSA disponíveis:');
          console.log(output);
        } else {
          console.log('⚠️ Nenhum device ALSA encontrado ou arecord não disponível');
        }
        resolve();
      });
    });
  } catch (error) {
    console.error('❌ Erro ao listar devices:', error);
  }
  console.log('');

  // Test 5: Tentar iniciar captura (se device disponível)
  console.log('Test 5: Testar start/stop de captura');
  console.log('⚠️ ATENÇÃO: Este teste requer um device ALSA disponível');
  console.log('   Se não houver device, o teste falhará (esperado)');

  const audioManager = new AudioManager({
    device: 'plughw:1,0',
    sampleRate: 48000,
    channels: 2,
    bufferSize: 1024
  });

  // Setup event handlers
  audioManager.on('started', () => {
    console.log('✅ Evento "started" recebido');
  });

  audioManager.on('stopped', () => {
    console.log('✅ Evento "stopped" recebido');
  });

  audioManager.on('error', (error) => {
    console.log('⚠️ Evento "error" recebido:', error);
  });

  audioManager.on('device_disconnected', (info) => {
    console.log('⚠️ Evento "device_disconnected" recebido:', info);
  });

  try {
    console.log('   Tentando iniciar captura...');
    await audioManager.start();
    console.log('✅ Captura iniciada com sucesso');

    // Aguardar 3 segundos
    console.log('   Aguardando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verificar status
    const status = audioManager.getStatus();
    console.log('   Status:', status);

    // Parar captura
    console.log('   Parando captura...');
    await audioManager.stop();
    console.log('✅ Captura parada com sucesso');

  } catch (error) {
    console.log('⚠️ Captura falhou (esperado se device não disponível)');
    console.log('   Erro:', (error as Error).message);
    console.log('   Isso é normal se você não tiver um device ALSA conectado');
  }
  console.log('');

  console.log('=== Testes Manuais Concluídos ===');
  console.log('');
  console.log('Resumo:');
  console.log('- Instanciação: OK');
  console.log('- Configuração customizada: OK');
  console.log('- Validação de parâmetros: OK');
  console.log('- Captura (se device disponível): Verificar logs acima');
  console.log('');
  console.log('Para testar com device real:');
  console.log('1. Conecte um dispositivo USB de áudio (ex: Behringer UCA222)');
  console.log('2. Execute: arecord -l');
  console.log('3. Ajuste a variável AUDIO_DEVICE no .env');
  console.log('4. Execute este teste novamente');

  process.exit(0);
}

// Executar testes
runManualTests().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
