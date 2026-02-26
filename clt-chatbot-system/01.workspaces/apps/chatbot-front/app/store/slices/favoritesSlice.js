// app/store/slices/favoritesSlice.js
import { apiFetch } from "../../lib/apiClient";
import { getErrorKey } from "../../lib/errorHandler";
import { locales } from "../../lib/locales"; // 오류 메시지를 위해 추가

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export const createFavoritesSlice = (set, get) => ({
  // State
  favorites: [],
  unsubscribeFavorites: null,

  // Actions
  loadFavorites: async () => {
    try {
      const response = await apiFetch(`${BASE_URL}/favorites`);
      if (!response.ok) throw new Error("Failed to load favorites.");
      const favorites = await response.json();
      set({ favorites });
    } catch (error) {
      console.error("Error loading favorites:", error);
      const { language, showEphemeralToast } = get();
      const errorKey = getErrorKey(error);
      const message = locales[language]?.[errorKey] || locales['en']?.errorUnexpected || 'Failed to load favorites.';
      showEphemeralToast(message, 'error');
    }
  },

  addFavorite: async (favoriteData) => {
    const { favorites, maxFavorites, language, showEphemeralToast } = get();

    if (favorites.length >= maxFavorites) {
      showEphemeralToast(locales[language]?.['최대 즐겨찾기 개수에 도달했습니다.'] || "Favorite limit reached.", "error");
      return;
    }

    try {
      const currentOrder = get().favorites.length;
      const response = await apiFetch(`${BASE_URL}/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...favoriteData, order: currentOrder }),
      });
      if (!response.ok) throw new Error("Failed to add favorite.");
      const created = await response.json();
      set((state) => ({ favorites: [...state.favorites, created] }));
      // 성공 메시지는 toggleFavorite에서 처리
    } catch (error) {
      console.error("Error adding favorite:", error);
      const errorKey = getErrorKey(error);
      const message = locales[language]?.[errorKey] || locales['en']?.errorUnexpected || 'Failed to add favorite.';
      showEphemeralToast(message, 'error');
    }
  },

  updateFavoritesOrder: async (newOrder) => {
    const { favorites: originalOrder, language, showEphemeralToast } = get();

    // 낙관적 UI 업데이트
    set({ favorites: newOrder });

    try {
      const orders = newOrder.map((fav, index) => ({ id: fav.id, order: index }));
      const response = await apiFetch(`${BASE_URL}/favorites/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!response.ok) throw new Error("Failed to save new order.");
    } catch (error) {
      console.error("Error updating favorites order:", error);
      const errorKey = getErrorKey(error);
      const message = locales[language]?.[errorKey] || locales['en']?.errorUnexpected || 'Failed to save new order.';
      showEphemeralToast(message, 'error');
      set({ favorites: originalOrder }); // 롤백
    }
  },

  deleteFavorite: async (favoriteId) => {
    const { favorites: originalFavorites, language, showEphemeralToast } = get();

    const favoriteToDelete = originalFavorites.find(
      (fav) => fav.id === favoriteId
    );
    if (!favoriteToDelete) {
        console.warn(`Favorite with ID ${favoriteId} not found for deletion.`);
        return;
    }

    // 낙관적 UI 업데이트
    const newFavorites = originalFavorites
      .filter((fav) => fav.id !== favoriteId)
      .map((fav, index) => ({ ...fav, order: index }));
    set({ favorites: newFavorites });

    try {
      const response = await apiFetch(`${BASE_URL}/favorites/${favoriteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete favorite.");
      await apiFetch(`${BASE_URL}/favorites/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: newFavorites.map((fav) => ({ id: fav.id, order: fav.order })),
        }),
      });
      // 성공 메시지는 toggleFavorite에서 처리
    } catch (error) {
      console.error("Error deleting favorite:", error);
      const errorKey = getErrorKey(error);
      const message = locales[language]?.[errorKey] || locales['en']?.errorUnexpected || 'Failed to delete favorite.';
      showEphemeralToast(message, 'error');
      set({ favorites: originalFavorites }); // 롤백
    }
  },

  toggleFavorite: async (item) => {
    const {
      user,
      favorites,
      addFavorite,
      deleteFavorite,
      showEphemeralToast,
      maxFavorites,
      language,
    } = get();
    if (!user || !item?.action?.type || typeof item.action.value !== 'string' || !item.action.value.trim()) {
        console.warn("Invalid item provided to toggleFavorite:", item);
        return;
    }

    const valueToCompare = item.action.value.trim();
    const favoriteToDelete = favorites.find(
      (fav) =>
        fav.action?.type === item.action.type &&
        fav.action?.value?.trim() === valueToCompare
    );

    if (favoriteToDelete) {
      await deleteFavorite(favoriteToDelete.id);
      // 삭제 성공 여부 확인 (딜레이 후)
      setTimeout(() => {
          if (!get().favorites.find(f => f.id === favoriteToDelete.id)) {
              showEphemeralToast(locales[language]?.['즐겨찾기에서 삭제되었습니다.'] || "Removed from favorites.", "info");
          }
      }, 300);
    } else {
      if (favorites.length >= maxFavorites) {
        showEphemeralToast(locales[language]?.['최대 즐겨찾기 개수에 도달했습니다.'] || "Favorite limit reached.", "error");
        return;
      }
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
          console.warn("Cannot add favorite with empty title:", item);
          showEphemeralToast("Cannot add favorite with empty title.", "error");
          return;
      }
      const newFavorite = {
        icon: "🌟",
        title: item.title.trim(),
        description: item.description || "",
        action: { type: item.action.type, value: valueToCompare },
      };
      await addFavorite(newFavorite);
      // 추가 성공 여부 확인 (딜레이 후)
      setTimeout(() => {
          if (get().favorites.some(fav => fav.action.value === newFavorite.action.value && fav.action.type === newFavorite.action.type)) {
             showEphemeralToast(locales[language]?.['즐겨찾기에 추가되었습니다.'] || "Added to favorites.", "success");
          }
      }, 300);
    }
  },
});
