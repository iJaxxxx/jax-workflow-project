import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent 等价于 AppRegistry.registerComponent("main", () => App)，
// 同时保证 Expo Go 和原生构建下的运行环境一致
registerRootComponent(App);
