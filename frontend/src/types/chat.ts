// frontend/src/types/chat.ts

export interface PanelData {
    current_time?: string | null;
    current_date?: string | null;
    current_location?: string | null;
}

export interface ChatTurnResponse {
    user_message: ChatMessageData;
    ai_message: ChatMessageData;
    panel_data_update?: PanelData | null;
}

// Redefine ChatMessageData to match backend and frontend usage
export interface ChatMessageData {
    id: string;
    chat_session_id: string;
    sender_type: "USER" | "AI" | "SYSTEM";
    content: string;
    timestamp: string;
    message_metadata?: {
        reasoning_tokens?: number;
        usage?: Record<string, any>;
        [key: string]: any;
    };
    active_persona_name?: string | null;
    active_persona_image_url?: string | null;
    is_beginning_message?: boolean;
    ai_responses?: { content: string; timestamp: string }[];
    current_response_index?: number;
    user_message_id?: string;
}
