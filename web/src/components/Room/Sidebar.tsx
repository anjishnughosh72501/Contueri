import React from 'react';
import { Chat } from './Chat';
import { People } from './People';
import { Queue } from './Queue';
import { Activities } from './Activities';
import {
  ChatMessage,
  Member,
  QueueItem,
  ActivityState,
  EmoteKind,
  DrawStroke,
} from '@contueri/shared';

interface SidebarProps {
  activeTab: 'chat' | 'people' | 'queue' | 'activities';
  unreadChatCount: number;
  messages: ChatMessage[];
  currentMemberName: string;
  typingMembers: Record<string, boolean>;
  members: Member[];
  queue: QueueItem[];
  activity: ActivityState;
  selfId: string | null;
  onSelectTab: (tab: 'chat' | 'people' | 'queue' | 'activities') => void;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onSendEmote: (kind: EmoteKind, targetId?: string) => void;
  onQueueAdd: (url: string) => void;
  onQueueVote: (itemId: string) => void;
  onQueueRemove: (itemId: string) => void;
  onQueuePlayNext: () => void;
  onSetActivity: (type: 'poll' | 'tictactoe' | 'draw' | null) => void;
  onPollCreate: (question: string, options: string[]) => void;
  onPollVote: (optionIndex: number) => void;
  onPollClose: () => void;
  onTttJoin: (side: 'X' | 'O') => void;
  onTttMove: (index: number) => void;
  onTttReset: () => void;
  onDrawStroke: (stroke: DrawStroke) => void;
  onDrawClear: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  unreadChatCount,
  messages,
  currentMemberName,
  typingMembers,
  members,
  queue,
  activity,
  selfId,
  onSelectTab,
  onSendMessage,
  onTyping,
  onSendEmote,
  onQueueAdd,
  onQueueVote,
  onQueueRemove,
  onQueuePlayNext,
  onSetActivity,
  onPollCreate,
  onPollVote,
  onPollClose,
  onTttJoin,
  onTttMove,
  onTttReset,
  onDrawStroke,
  onDrawClear,
}) => {
  return (
    <aside className="sidebar" aria-label="Lounge sidebar">
      <div className="sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => onSelectTab('chat')}
        >
          <span>💬 Chat</span>
          {unreadChatCount > 0 && activeTab !== 'chat' && (
            <span className="tab-badge" aria-label={`${unreadChatCount} unread messages`}>
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'people'}
          className={`sidebar-tab ${activeTab === 'people' ? 'active' : ''}`}
          onClick={() => onSelectTab('people')}
        >
          <span>👥 People ({members.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          className={`sidebar-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => onSelectTab('queue')}
        >
          <span>📋 Queue {queue.length > 0 ? `(${queue.length})` : ''}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'activities'}
          className={`sidebar-tab ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => onSelectTab('activities')}
        >
          <span>🎯 Activities</span>
        </button>
      </div>

      {activeTab === 'chat' && (
        <Chat
          messages={messages}
          currentMemberName={currentMemberName}
          typingMembers={typingMembers}
          members={members}
          onSendMessage={onSendMessage}
          onTyping={onTyping}
        />
      )}

      {activeTab === 'people' && (
        <People
          members={members}
          selfId={selfId}
          onSendEmote={onSendEmote}
        />
      )}

      {activeTab === 'queue' && (
        <Queue
          items={queue}
          onAdd={onQueueAdd}
          onVote={onQueueVote}
          onRemove={onQueueRemove}
          onPlayNext={onQueuePlayNext}
        />
      )}

      {activeTab === 'activities' && (
        <Activities
          activity={activity}
          onSetActivity={onSetActivity}
          onPollCreate={onPollCreate}
          onPollVote={onPollVote}
          onPollClose={onPollClose}
          onTttJoin={onTttJoin}
          onTttMove={onTttMove}
          onTttReset={onTttReset}
          onDrawStroke={onDrawStroke}
          onDrawClear={onDrawClear}
        />
      )}
    </aside>
  );
};
