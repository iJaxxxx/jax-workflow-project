import {
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	StatusBar,
	StyleSheet,
	Text,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { FavoriteList } from "./favorite-list";
import { SearchPanel } from "./search-panel";

// 没有引入 safe-area 依赖：iOS 用刘海屏状态栏的常见高度，Android 用系统状态栏高度
const TOP_INSET = Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 0);

/** 唯一的屏幕：顶部查询区，下方收藏列表（下拉刷新、编辑备注、删除、空状态） */
export function FavoritesScreen() {
	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			style={styles.container}
		>
			<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
				<View style={styles.header}>
					<Text accessibilityRole="header" style={styles.title}>
						GitHub 收藏
					</Text>
				</View>
			</TouchableWithoutFeedback>
			<SearchPanel />
			<View style={styles.list}>
				<FavoriteList />
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#f9fafb",
		flex: 1,
		paddingTop: TOP_INSET,
	},
	header: {
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	list: {
		flex: 1,
	},
	title: {
		color: "#111827",
		fontSize: 22,
		fontWeight: "700",
	},
});
