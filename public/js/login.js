/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  try {
    /* Axios, node.js ve tarayıcı için promise tabanlı HTTP İstemcisidir. izomorfik (= tarayıcıda ve node.js'de aynı kod tabanıyla çalışabilir). Sunucu tarafında yerel (native) node.js http modülünü, istemcide (tarayıcı) ise XMLHttpRequests'i kullanır.
  Özellikler
    Tarayıcı üzerinden XMLHttpRequests istekleri gönderme.
    Node.js üzerinden http istekleri gönderme.
    Promise API'sini destekler
    İsteklere ve yanıtlara yol kesiciler ekleme
    İstek ve yanıt verilerini dönüştürme
    İstekleri iptal etme
    JSON verileri için otomatik dönüşüm
    XSRF'ye karşı istemci taraflı koruma desteği 
  */
    const res = await axios({
      // axios'u incelemeliyiz
      method: 'POST',
      url: 'http://127.0.0.1:3000/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: 'http://127.0.0.1:3000/api/v1/users/logout',
    });

    // Really important is that we actually need to set it to true here, and that will then force a reload from the server and not from browser cache. So this part here is really important again because otherwise it might simply load the same page from the cache which would then still have our user menu up there. But of course that's not what we want, we really want a fresh page coming down from the server.
    if (res.data.status === 'success') location.assign('/');
  } catch (err) {
    showAlert('error', 'Error logging out! Try again.');
  }
};
