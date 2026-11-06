// biome-ignore-all lint/style/useFilenamingConvention: Expo 约定的根组件文件名是 App.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "./src/api";
import { FavoritesScreen } from "./src/favorites-screen";

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<FavoritesScreen />
			<StatusBar style="auto" />
		</QueryClientProvider>
	);
}
