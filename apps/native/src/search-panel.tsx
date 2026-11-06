import type { GithubProfile } from "@jax-workflow-project/github-users/schema";
import { useState } from "react";
import {
	ActivityIndicator,
	Image,
	Keyboard,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import {
	describeError,
	describeSearchError,
	useAddFavorite,
	useFavorites,
	useSearchUser,
	validateUsername,
} from "./api";

const formatFollowers = (followers: number | null): string =>
	followers === null ? "粉丝数未知" : `${followers.toLocaleString()} 粉丝`;

interface ResultCardProps {
	profile: GithubProfile;
}

function ResultCard({ profile }: ResultCardProps) {
	const favorites = useFavorites();
	const addFavorite = useAddFavorite();
	const alreadyAdded =
		favorites.data?.some((u) => u.githubId === profile.githubId) ?? false;
	// 列表还没加载出来时不知道是否已收藏，先不让点，避免重复添加
	const listReady = favorites.data !== undefined;
	const disabled = alreadyAdded || addFavorite.isPending || !listReady;

	const handleAdd = () => {
		if (disabled) {
			return;
		}
		addFavorite.mutate(profile);
	};

	let buttonLabel = "添加";
	if (alreadyAdded) {
		buttonLabel = "已添加";
	} else if (addFavorite.isPending) {
		buttonLabel = "添加中…";
	}

	return (
		<View style={styles.card} testID="search-result">
			<View style={styles.cardRow}>
				{profile.avatarUrl ? (
					<Image
						accessibilityLabel={`${profile.login} 的头像`}
						source={{ uri: profile.avatarUrl }}
						style={styles.avatar}
					/>
				) : (
					<View style={[styles.avatar, styles.avatarPlaceholder]} />
				)}
				<View style={styles.cardInfo}>
					<Text numberOfLines={1} style={styles.login}>
						{profile.login}
					</Text>
					<Text numberOfLines={1} style={styles.name}>
						{profile.name ?? "（未填写姓名）"}
					</Text>
					<Text style={styles.followers}>
						{formatFollowers(profile.followers)}
					</Text>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ busy: addFavorite.isPending, disabled }}
					disabled={disabled}
					onPress={handleAdd}
					style={({ pressed }) => [
						styles.button,
						disabled && styles.buttonDisabled,
						pressed && !disabled && styles.buttonPressed,
					]}
				>
					<Text
						style={[styles.buttonText, disabled && styles.buttonTextDisabled]}
					>
						{buttonLabel}
					</Text>
				</Pressable>
			</View>
			{favorites.isError && !listReady ? (
				<Text style={styles.error}>{describeError(favorites.error)}</Text>
			) : null}
			{addFavorite.isError ? (
				<Text style={styles.error}>{describeError(addFavorite.error)}</Text>
			) : null}
		</View>
	);
}

/** 收藏页顶部的查询区：输入框、"查询"按钮、结果卡片和错误提示 */
export function SearchPanel() {
	const [username, setUsername] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const search = useSearchUser();

	const trimmed = username.trim();
	const canSearch = trimmed.length > 0 && !search.isPending;

	const handleSearch = () => {
		if (!canSearch) {
			return;
		}
		const invalid = validateUsername(trimmed);
		if (invalid) {
			search.reset();
			setValidationError(invalid);
			return;
		}
		setValidationError(null);
		Keyboard.dismiss();
		search.mutate(trimmed);
	};

	const handleChange = (text: string) => {
		setUsername(text);
		if (validationError) {
			setValidationError(null);
		}
	};

	let errorMessage: string | null = validationError;
	if (!errorMessage && search.isError) {
		errorMessage = describeSearchError(search.error);
	}

	return (
		<View style={styles.panel}>
			<View style={styles.inputRow}>
				<TextInput
					accessibilityLabel="GitHub 用户名"
					autoCapitalize="none"
					autoComplete="off"
					autoCorrect={false}
					clearButtonMode="while-editing"
					editable={!search.isPending}
					onChangeText={handleChange}
					onSubmitEditing={handleSearch}
					placeholder="输入 GitHub 用户名"
					placeholderTextColor="#9ca3af"
					returnKeyType="search"
					style={styles.input}
					value={username}
				/>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ busy: search.isPending, disabled: !canSearch }}
					disabled={!canSearch}
					onPress={handleSearch}
					style={({ pressed }) => [
						styles.button,
						!canSearch && styles.buttonDisabled,
						pressed && canSearch && styles.buttonPressed,
					]}
				>
					{search.isPending ? (
						<ActivityIndicator color="#9ca3af" size="small" />
					) : (
						<Text
							style={[
								styles.buttonText,
								!canSearch && styles.buttonTextDisabled,
							]}
						>
							查询
						</Text>
					)}
				</Pressable>
			</View>
			{errorMessage ? (
				<Text accessibilityRole="alert" style={styles.error}>
					{errorMessage}
				</Text>
			) : null}
			{search.isSuccess && !validationError ? (
				<ResultCard key={search.data.githubId} profile={search.data} />
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	avatar: {
		backgroundColor: "#e5e7eb",
		borderRadius: 24,
		height: 48,
		width: 48,
	},
	avatarPlaceholder: {
		borderColor: "#d1d5db",
		borderWidth: StyleSheet.hairlineWidth,
	},
	button: {
		alignItems: "center",
		backgroundColor: "#111827",
		borderRadius: 8,
		justifyContent: "center",
		minHeight: 44,
		minWidth: 72,
		paddingHorizontal: 14,
	},
	buttonDisabled: {
		backgroundColor: "#e5e7eb",
	},
	buttonPressed: {
		opacity: 0.8,
	},
	buttonText: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "600",
	},
	buttonTextDisabled: {
		color: "#6b7280",
	},
	card: {
		backgroundColor: "#fff",
		borderColor: "#e5e7eb",
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 8,
		marginTop: 12,
		padding: 12,
	},
	cardInfo: {
		flex: 1,
		gap: 2,
	},
	cardRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
	},
	error: {
		color: "#dc2626",
		fontSize: 14,
		marginTop: 8,
	},
	followers: {
		color: "#6b7280",
		fontSize: 13,
	},
	input: {
		backgroundColor: "#fff",
		borderColor: "#d1d5db",
		borderRadius: 8,
		borderWidth: 1,
		color: "#111827",
		flex: 1,
		fontSize: 16,
		minHeight: 44,
		paddingHorizontal: 12,
	},
	inputRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	login: {
		color: "#111827",
		fontSize: 16,
		fontWeight: "600",
	},
	name: {
		color: "#374151",
		fontSize: 14,
	},
	panel: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
});
