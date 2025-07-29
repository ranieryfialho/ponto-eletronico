import { auth } from './firebase-config';

// Função para converter a chave pública para o formato Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Função para ATIVAR as notificações
export async function setupPushNotifications() {
  if (!('serviceWorker' in navigator && 'PushManager' in window)) {
    return { success: false, message: 'As notificações push não são suportadas neste navegador.' };
  }

  try {
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permissão para notificações não foi concedida. Por favor, habilite nas configurações do seu navegador.');
    }

    const swRegistration = await navigator.serviceWorker.register('/sw.js');
    const VAPID_PUBLIC_KEY = 'BBS4htjq63LVdxEmN5FYcRAiTvtwBpj6oGTzvGtrVUZe6V9RHGHDeRGgYIsQg-ejn8g7spe8ogoE8kdanJ1N6KI';

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/save-subscription', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao salvar inscrição no servidor.');
    }

    return { success: true, message: 'Lembretes ativados com sucesso!' };
  } catch (error) {
    console.error('Erro ao configurar notificações push:', error);
    return { success: false, message: error.message };
  }
}

// NOVO: Função para DESATIVAR as notificações
export async function unsubscribePushNotifications() {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        return { success: false, message: 'Recurso não suportado.' };
    }

    try {
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.getSubscription();

        if (!subscription) {
            return { success: true, message: 'Nenhuma inscrição ativa encontrada.' };
        }

        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/remove-subscription', {
            method: 'POST',
            body: JSON.stringify({ subscription }),
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao remover inscrição do servidor.');
        }

        await subscription.unsubscribe();

        return { success: true, message: 'Lembretes desativados com sucesso!' };
    } catch (error) {
        console.error('Erro ao cancelar inscrição de notificações:', error);
        return { success: false, message: error.message };
    }
}