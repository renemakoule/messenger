// hooks/useChatFilters.ts
"use client";

import { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from 'uuid';
import { ClientChatFilter, FilterCriteria } from "@/types/filter";
import { useAuth } from "@/context/auth-context";

const LOCAL_STORAGE_FILTERS_KEY = "chatAppClientFilters";

// Recopier le type Chat ici pour que le hook soit autonome
type ChatWithDetails = {
    id: string;
    name: string | null;
    is_group: boolean;
    unread_count: number;
    labels: { id: string }[];
    // ... ajoutez d'autres champs si nécessaire pour le filtrage
};

export function useChatFilters(allChats: ChatWithDetails[]) {
    const { user } = useAuth();
    const [definedFilters, setDefinedFilters] = useState<ClientChatFilter[]>([]);
    const [activeFilter, setActiveFilter] = useState<ClientChatFilter | null>(null);

    // Charger les filtres depuis le localStorage au montage
    useEffect(() => {
        if (!user) return;
        try {
            const storedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
            if (storedFilters) {
                setDefinedFilters(JSON.parse(storedFilters));
            } else {
                // Créer un filtre "All Chats" par défaut s'il n'y en a pas
                const defaultFilter = { id: uuidv4(), name: "All Chats", criteria: {} };
                setDefinedFilters([defaultFilter]);
            }
        } catch (e) {
            console.error("Failed to parse filters from localStorage", e);
            setDefinedFilters([]);
        }
    }, [user]);

    // Sauvegarder les filtres dans le localStorage à chaque changement
    useEffect(() => {
        if (definedFilters.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(definedFilters));
        }
    }, [definedFilters]);
    
    const saveFilter = (name: string, criteria: FilterCriteria, existingId?: string) => {
        if (existingId) {
            // Mise à jour d'un filtre existant
            setDefinedFilters(prev => prev.map(f => f.id === existingId ? { ...f, name, criteria } : f));
        } else {
            // Création d'un nouveau filtre
            const newFilter: ClientChatFilter = { id: uuidv4(), name, criteria };
            setDefinedFilters(prev => [...prev, newFilter]);
        }
    };

    const deleteFilter = (filterId: string) => {
        setDefinedFilters(prev => prev.filter(f => f.id !== filterId));
        // Si le filtre supprimé était actif, on désactive le filtre
        if (activeFilter?.id === filterId) {
            setActiveFilter(null);
        }
    };

    const applyFilter = (filter: ClientChatFilter | null) => {
        setActiveFilter(filter);
    };

    const filteredChats = useMemo(() => {
        if (!activeFilter || Object.keys(activeFilter.criteria).length === 0) {
            return allChats;
        }

        const { criteria } = activeFilter;
        return allChats.filter(chat => {
            if (criteria.unread && chat.unread_count === 0) return false;
            if (criteria.is_group !== undefined && chat.is_group !== criteria.is_group) return false;
            if (criteria.chat_name_contains && !chat.name?.toLowerCase().includes(criteria.chat_name_contains.toLowerCase())) return false;
            
            if (criteria.labels && criteria.labels.length > 0) {
                const chatLabelIds = new Set(chat.labels.map(l => l.id));
                if (criteria.label_match_type === 'all') {
                    if (!criteria.labels.every(labelId => chatLabelIds.has(labelId))) return false;
                } else { // 'any'
                    if (!criteria.labels.some(labelId => chatLabelIds.has(labelId))) return false;
                }
            }
            
            // Ajoutez d'autres logiques de filtre ici si nécessaire
            
            return true;
        });
    }, [allChats, activeFilter]);

    return {
        filteredChats,
        definedFilters,
        activeFilter,
        saveFilter,
        deleteFilter,
        applyFilter,
    };
}