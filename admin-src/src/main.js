import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles/admin.css';

document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark');
window.addEventListener('admin:unauthorized', () => {
  localStorage.removeItem('XBOARD_ACCESS_TOKEN');
  if (router.currentRoute.value.name !== 'Login') router.replace({ name: 'Login' });
});

createApp(App).use(router).mount('#app');
