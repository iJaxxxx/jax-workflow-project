import type { FavoriteUser } from "@jax-workflow-project/github-users/schema";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import {
	describeError,
	MESSAGE_ALREADY_DELETED,
	MESSAGE_EMPTY_LIST,
	useDeleteFavorite,
	useFavorites,
	useUpdateNote,
	validateNote,
} from "./api";

const formatFollowers = (followers: number | null): string =>
	followers === null ? "粉丝数未知" : `${followers.toLocaleString()} 粉丝`;

interface ActionButtonProps {
	disabled?: boolean;
	label: string;
	onPress: () => void;
	variant?: "primary" | "secondary" | "danger";
}

function ActionButton({
	disabled = false,
	label,
	onPress,
	variant = "secondary",
}: ActionButtonProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.actionButton,
				variant === "primary" && styles.actionPrimary,
				variant === "danger" && styles.actionDanger,
				disabled && styles.actionDisabled,
				pressed && !disabled && styles.actionPressed,
			]}
		>
			<Text
				style={[
					styles.actionText,
					variant === "primary" && styles.actionTextPrimary,
					variant === "danger" && styles.actionTextDanger,
					disabled && styles.actionTextDisabled,
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

interface FavoriteItemProps {
	user: FavoriteUser;
}

function FavoriteItem({ user }: FavoriteItemProps) {
	const updateNote = useUpdateNote();
	const deleteFavorite = useDeleteFavorite();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [noteError, setNoteError] = useState<string | null>(null);

	const busy = updateNote.isPending || deleteFavorite.isPending;

	const startEdit = () => {
		updateNote.reset();
		setDraft(user.note ?? "");
		setNoteError(null);
		setEditing(true);
	};

	const cancelEdit = () => {
		updateNote.reset();
		setNoteError(null);
		setEditing(false);
	};

	const saveNote = () => {
		if (updateNote.isPending) {
			return;
		}
		const invalid = validateNote(draft);
		if (invalid) {
			setNoteError(invalid);
			return;
		}
		setNoteError(null);
		updateNote.mutate(
			{ githubId: user.githubId, note: draft },
			{ onSuccess: () => setEditing(false) }
		);
	};

	const confirmDelete = () => {
		if (deleteFavorite.isPending) {
			return;
		}
		Alert.alert("删除收藏", `确定要删除 ${user.login} 吗？`, [
			{ style: "cancel", text: "取消" },
			{
				onPress: () => {
					deleteFavorite.mutate(user.githubId, {
						onSuccess: ({ alreadyDeleted }) => {
							if (alreadyDeleted) {
								Alert.alert(MESSAGE_ALREADY_DELETED);
							}
						},
					});
				},
				style: "destructive",
				text: "删除",
			},
		]);
	};

	const handleDraftChange = (text: string) => {
		setDraft(text);
		if (noteError) {
			setNoteError(null);
		}
	};

	let errorMessage: string | null = noteError;
	if (!errorMessage && updateNote.isError) {
		errorMessage = describeError(updateNote.error);
	}
	if (!errorMessage && deleteFavorite.isError) {
		errorMessage = describeError(deleteFavorite.error);
	}

	return (
		<View style={styles.item} testID={`favorite-${user.githubId}`}>
			<View style={styles.itemRow}>
				{user.avatarUrl ? (
					<Image
						accessibilityLabel={`${user.login} 的头像`}
						source={{ uri: user.avatarUrl }}
						style={styles.avatar}
					/>
				) : (
					<View style={[styles.avatar, styles.avatarPlaceholder]} />
				)}
				<View style={styles.itemInfo}>
					<Text numberOfLines={1} style={styles.login}>
						{user.login}
					</Text>
					<Text numberOfLines={1} style={styles.name}>
						{user.name ?? "（未填写姓名）"}
					</Text>
					<Text style={styles.followers}>
						{formatFollowers(user.followers)}
					</Text>
				</View>
			</View>

			{editing ? (
				<View style={styles.editBox}>
					<TextInput
						accessibilityLabel={`${user.login} 的备注`}
						autoFocus
						editable={!updateNote.isPending}
						multiline
						onChangeText={handleDraftChange}
						placeholder="写点备注（留空则清空备注）"
						placeholderTextColor="#9ca3af"
						style={styles.noteInput}
						value={draft}
					/>
					<Text
						style={[styles.counter, draft.length > 1000 && styles.counterOver]}
					>
						{draft.length} / 1000
					</Text>
					<View style={styles.actions}>
						<ActionButton
							disabled={updateNote.isPending}
							label="取消"
							onPress={cancelEdit}
						/>
						<ActionButton
							disabled={updateNote.isPending}
							label={updateNote.isPending ? "保存中…" : "保存"}
							onPress={saveNote}
							variant="primary"
						/>
					</View>
				</View>
			) : (
				<>
					<Text style={user.note ? styles.note : styles.noteEmpty}>
						{user.note ? user.note : "暂无备注"}
					</Text>
					<View style={styles.actions}>
						<ActionButton
							disabled={busy}
							label="编辑备注"
							onPress={startEdit}
						/>
						<ActionButton
							disabled={busy}
							label={deleteFavorite.isPending ? "删除中…" : "删除"}
							onPress={confirmDelete}
							variant="danger"
						/>
					</View>
				</>
			)}

			{errorMessage ? (
				<Text accessibilityRole="alert" style={styles.error}>
					{errorMessage}
				</Text>
			) : null}
		</View>
	);
}

/** 收藏列表：加载 / 错误 / 空状态、下拉刷新、编辑备注、删除 */
export function FavoriteList() {
	const favorites = useFavorites();

	if (favorites.isPending) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color="#6b7280" />
				<Text style={styles.hint}>正在加载收藏列表…</Text>
			</View>
		);
	}

	if (favorites.isError && favorites.data === undefined) {
		return (
			<View style={styles.center}>
				<Text accessibilityRole="alert" style={styles.error}>
					{describeError(favorites.error)}
				</Text>
				<ActionButton
					disabled={favorites.isFetching}
					label={favorites.isFetching ? "重试中…" : "重试"}
					onPress={() => {
						favorites.refetch();
					}}
					variant="primary"
				/>
			</View>
		);
	}

	const refreshing = favorites.isRefetching;

	return (
		<FlatList
			contentContainerStyle={
				favorites.data.length === 0 ? styles.emptyContainer : styles.content
			}
			data={favorites.data}
			keyboardDismissMode="on-drag"
			keyboardShouldPersistTaps="handled"
			keyExtractor={(item) => String(item.githubId)}
			ListEmptyComponent={
				<Text style={styles.hint} testID="favorites-empty">
					{MESSAGE_EMPTY_LIST}
				</Text>
			}
			ListHeaderComponent={
				favorites.isError ? (
					<Text accessibilityRole="alert" style={styles.error}>
						{describeError(favorites.error)}（下拉重试）
					</Text>
				) : undefined
			}
			refreshControl={
				<RefreshControl
					onRefresh={() => {
						favorites.refetch();
					}}
					refreshing={refreshing}
				/>
			}
			renderItem={({ item }) => <FavoriteItem user={item} />}
		/>
	);
}

const styles = StyleSheet.create({
	actionButton: {
		alignItems: "center",
		backgroundColor: "#fff",
		borderColor: "#d1d5db",
		borderRadius: 8,
		borderWidth: 1,
		justifyContent: "center",
		minHeight: 40,
		minWidth: 64,
		paddingHorizontal: 12,
	},
	actionDanger: {
		borderColor: "#fca5a5",
	},
	actionDisabled: {
		backgroundColor: "#f3f4f6",
		borderColor: "#e5e7eb",
	},
	actionPressed: {
		opacity: 0.7,
	},
	actionPrimary: {
		backgroundColor: "#111827",
		borderColor: "#111827",
	},
	actions: {
		flexDirection: "row",
		gap: 8,
		justifyContent: "flex-end",
	},
	actionText: {
		color: "#111827",
		fontSize: 14,
		fontWeight: "600",
	},
	actionTextDanger: {
		color: "#dc2626",
	},
	actionTextDisabled: {
		color: "#9ca3af",
	},
	actionTextPrimary: {
		color: "#fff",
	},
	avatar: {
		backgroundColor: "#e5e7eb",
		borderRadius: 22,
		height: 44,
		width: 44,
	},
	avatarPlaceholder: {
		borderColor: "#d1d5db",
		borderWidth: StyleSheet.hairlineWidth,
	},
	center: {
		alignItems: "center",
		flex: 1,
		gap: 12,
		justifyContent: "center",
		padding: 24,
	},
	content: {
		gap: 12,
		paddingBottom: 24,
		paddingHorizontal: 16,
	},
	counter: {
		alignSelf: "flex-end",
		color: "#6b7280",
		fontSize: 12,
	},
	counterOver: {
		color: "#dc2626",
	},
	editBox: {
		gap: 8,
	},
	emptyContainer: {
		alignItems: "center",
		flexGrow: 1,
		justifyContent: "center",
		padding: 24,
	},
	error: {
		color: "#dc2626",
		fontSize: 14,
		textAlign: "center",
	},
	followers: {
		color: "#6b7280",
		fontSize: 13,
	},
	hint: {
		color: "#6b7280",
		fontSize: 15,
	},
	item: {
		backgroundColor: "#fff",
		borderColor: "#e5e7eb",
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 10,
		padding: 12,
	},
	itemInfo: {
		flex: 1,
		gap: 2,
	},
	itemRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
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
	note: {
		color: "#111827",
		fontSize: 14,
	},
	noteEmpty: {
		color: "#9ca3af",
		fontSize: 14,
	},
	noteInput: {
		backgroundColor: "#fff",
		borderColor: "#d1d5db",
		borderRadius: 8,
		borderWidth: 1,
		color: "#111827",
		fontSize: 15,
		maxHeight: 160,
		minHeight: 72,
		padding: 10,
		textAlignVertical: "top",
	},
});
