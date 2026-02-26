import App from './App.vue'
import router from './router'
import store from  './stores';

import './styles.css';

const app = createApp(App)

app.use(store)
app.use(router)

app.mount('#app')
