import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Sun,
  Moon,
  Globe,
  Terminal,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ConnectorsIcon } from './Icons';
import { AnimatePresence, motion } from 'motion/react';
import {
  LIQUID_EASE,
  MODAL_BACKDROP_ENTER,
  MODAL_BACKDROP_EXIT,
  MODAL_SHEET_ENTER,
  MODAL_SHEET_EXIT,
} from '../lib/motion';
import { User } from 'firebase/auth';
import { CustomSlashCommand, syncUserProfile, updateProfile } from '../lib/firebase';
import {
  getBuiltInCommands,
  getStarterCommandTemplates,
  normalizeCommandName,
} from '../lib/commands';
import { Language } from '../lib/i18n';

export type FontPreference = 'auto' | 'tr-sans' | 'jakarta' | 'serif';
export type SettingsTab = 'profile' | 'commands' | 'general';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTab;
  user: User | null;
  lang: Language;
  theme: 'light' | 'dark';
  fontPref: FontPreference;
  customCommands: CustomSlashCommand[];
  workspaceConnected: boolean;
  workspaceEmail: string | null;
  onSaveCommand: (
    cmd: { id?: string; name: string; description: string; prompt: string }
  ) => Promise<void>;
  onDeleteCommand: (commandId: string) => Promise<void>;
  onToggleTheme: () => void;
  onChangeLang: (lang: Language) => void;
  onChangeFontPref: (pref: FontPreference) => void;
  onOpenConnectors: () => void;
  onProfileUpdated?: () => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  initialTab = 'profile',
  user,
  lang,
  theme,
  fontPref,
  customCommands,
  workspaceConnected,
  workspaceEmail,
  onSaveCommand,
  onDeleteCommand,
  onToggleTheme,
  onChangeLang,
  onChangeFontPref,
  onOpenConnectors,
  onProfileUpdated,
  onClose,
}: SettingsModalProps) {
  const isTr = lang === 'tr';

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Profile editor state
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFormError(null);
      setProfileError(null);
      setProfileSaved(null);

      let initialName = user?.displayName || '';
      let initialPhoto = user?.photoURL || '';
      if (!user) {
        try {
          initialName = localStorage.getItem('lc_guest_name') || '';
          initialPhoto = localStorage.getItem('lc_guest_photo') || '';
        } catch {}
      }
      setProfileName(initialName);
      setProfilePhotoUrl(initialPhoto);
      setAvatarPreviewError(false);
    }
  }, [isOpen, initialTab, user]);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [profilePhotoUrl]);

  const builtIns = getBuiltInCommands(lang);
  const starters = getStarterCommandTemplates(lang);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(null);

    const trimmedName = profileName.trim();
    const trimmedPhoto = profilePhotoUrl.trim();

    if (!trimmedName) {
      setProfileError(
        isTr ? 'Lütfen bir görünen ad gir.' : 'Please enter a display name.'
      );
      return;
    }

    if (trimmedName.length > 100) {
      setProfileError(
        isTr
          ? 'Görünen ad en fazla 100 karakter olabilir.'
          : 'Display name can be at most 100 characters.'
      );
      return;
    }

    if (trimmedPhoto) {
      if (trimmedPhoto.length > 1000) {
        setProfileError(
          isTr
            ? 'Fotoğraf bağlantısı çok uzun.'
            : 'Photo URL is too long.'
        );
        return;
      }
      if (!/^https?:\/\/.+/i.test(trimmedPhoto)) {
        setProfileError(
          isTr
            ? 'Fotoğraf bağlantısı https:// ile başlamalı.'
            : 'Photo URL must start with https:// or http://.'
        );
        return;
      }
    }

    try {
      setSavingProfile(true);
      if (user) {
        await updateProfile(user, {
          displayName: trimmedName,
          photoURL: trimmedPhoto,
        });
        await syncUserProfile(user);
      } else {
        try {
          localStorage.setItem('lc_guest_name', trimmedName);
          if (trimmedPhoto) {
            localStorage.setItem('lc_guest_photo', trimmedPhoto);
          } else {
            localStorage.removeItem('lc_guest_photo');
          }
        } catch {}
      }
      onProfileUpdated?.();
      const label = isTr ? 'Profil güncellendi.' : 'Profile updated.';
      setProfileSaved(label);
      setTimeout(() => setProfileSaved((curr) => (curr === label ? null : curr)), 3000);
    } catch (err: any) {
      setProfileError(
        err?.message ||
          (isTr
            ? 'Profil güncellenemedi. Lütfen tekrar dene.'
            : 'Could not update profile. Please try again.')
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setDescInput('');
    setPromptInput('');
    setFormError(null);
  };

  const handleStartEdit = (cmd: CustomSlashCommand) => {
    setEditingId(cmd.id);
    setNameInput(cmd.name);
    setDescInput(cmd.description || '');
    setPromptInput(cmd.prompt);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const normalized = normalizeCommandName(nameInput);
    const trimmedPrompt = promptInput.trim();
    const trimmedDesc = descInput.trim();

    if (!normalized) {
      setFormError(
        isTr
          ? 'Komut adı en az bir harf veya rakamla başlamalı (örn. email, ozet).'
          : 'Command name must start with a letter or number (e.g. email, standup).'
      );
      return;
    }

    if (!trimmedPrompt) {
      setFormError(
        isTr
          ? 'Bu komut çalıştığında ne yapılacağını yazmalısın.'
          : 'Add the instruction this command should run.'
      );
      return;
    }

    const duplicate = customCommands.find(
      (c) => c.name.toLowerCase() === normalized && c.id !== editingId
    );
    if (duplicate) {
      setFormError(
        isTr
          ? `/${normalized} adında bir komutun zaten var.`
          : `You already have a /${normalized} command.`
      );
      return;
    }

    try {
      setSaving(true);
      await onSaveCommand({
        id: editingId || undefined,
        name: normalized,
        description: trimmedDesc,
        prompt: trimmedPrompt,
      });
      const label = editingId
        ? isTr
          ? `/${normalized} güncellendi.`
          : `Updated /${normalized}.`
        : isTr
          ? `/${normalized} eklendi. Artık sohbette yazabilirsin.`
          : `Added /${normalized}. You can type it in chat now.`;
      resetForm();
      setSavedNotice(label);
      setTimeout(() => setSavedNotice((curr) => (curr === label ? null : curr)), 3000);
    } catch (err: any) {
      setFormError(
        err?.message ||
          (isTr ? 'Komut kaydedilemedi. Tekrar dene.' : 'Could not save command. Please try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddStarter = async (tpl: {
    name: string;
    description: string;
    prompt: string;
  }) => {
    const exists = customCommands.some(
      (c) => c.name.toLowerCase() === tpl.name.toLowerCase()
    );
    if (exists) return;
    try {
      setSaving(true);
      await onSaveCommand(tpl);
      const label = isTr ? `/${tpl.name} eklendi.` : `Added /${tpl.name}.`;
      setSavedNotice(label);
      setTimeout(() => setSavedNotice((curr) => (curr === label ? null : curr)), 2600);
    } catch {
      // handled silently
    } finally {
      setSaving(false);
    }
  };

  const avatarInitial = (
    profileName.trim() ||
    user?.displayName ||
    user?.email ||
    'U'
  )[0].toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: MODAL_BACKDROP_ENTER }}
          exit={{ opacity: 0, transition: MODAL_BACKDROP_EXIT }}
          className="fixed inset-0 z-[75] bg-black/52 dark:bg-black/68 flex items-center justify-center p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            key="settings-modal-sheet"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: MODAL_SHEET_ENTER }}
            exit={{ opacity: 0, y: 8, scale: 0.985, transition: MODAL_SHEET_EXIT }}
            onClick={(e) => e.stopPropagation()}
            className="surface-3d-elevated w-full max-w-2xl max-h-[86dvh] rounded-3xl flex flex-col overflow-hidden text-[var(--tx)]"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 pt-5 pb-0 border-b border-[var(--bd)] shrink-0">
              <div className="flex items-center justify-between gap-3 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-medium tracking-tight">
                    {isTr ? 'Ayarlar' : 'Settings'}
                  </h2>
                  <p className="text-xs text-[var(--mut)] mt-0.5">
                    {isTr
                      ? 'Profilini, /komutlarını, görünümü ve çalışma alanını düzenle.'
                      : 'Customize your profile, /commands, typography, and workspace.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={isTr ? 'Kapat' : 'Close'}
                  className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Clean compositor-only active underline tabs */}
              <div className="flex items-center gap-6 text-xs font-medium">
                {(
                  [
                    { id: 'profile', label: isTr ? 'Profil' : 'Profile' },
                    { id: 'commands', label: isTr ? 'Komutlar (/)' : 'Commands (/)' },
                    { id: 'general', label: isTr ? 'Genel' : 'General' },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative pb-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'text-[var(--tx)] font-semibold'
                          : 'text-[var(--mut)] hover:text-[var(--tx)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[var(--editorial-accent)] origin-center transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === 'profile' ? (
                  <motion.div
                    key="settings-profile-panel"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: LIQUID_EASE }}
                    className="space-y-6"
                  >
                    {/* User Profile Update Form */}
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--ac)] text-[var(--on)] flex items-center justify-center font-display font-bold text-base shrink-0 overflow-hidden ring-1 ring-[var(--bd)]">
                          {/^https?:\/\/.+/i.test(profilePhotoUrl.trim()) && !avatarPreviewError ? (
                            <img
                              src={profilePhotoUrl.trim()}
                              alt=""
                              referrerPolicy="no-referrer"
                              onError={() => setAvatarPreviewError(true)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            avatarInitial
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate">
                            {isTr ? 'Profil bilgileri' : 'Your profile'}
                          </h3>
                          <p className="text-xs text-[var(--mut)] truncate mt-0.5">
                            {user?.email ||
                              (isTr
                                ? 'Misafir oturumu · Bu cihazda saklanır'
                                : 'Guest session · Saved on this device')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--mut)] mb-1">
                            {isTr ? 'Görünen ad' : 'Display name'}
                          </label>
                          <input
                            type="text"
                            value={profileName}
                            onChange={(e) => {
                              setProfileName(e.target.value);
                              if (profileError) setProfileError(null);
                            }}
                            placeholder={isTr ? 'Adın soyadın' : 'Your name'}
                            maxLength={100}
                            className="well-3d w-full rounded-xl px-3 h-9.5 outline-none text-sm text-[var(--tx)] placeholder:text-[var(--mut)]/65 focus:border-[var(--tx)]/45 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[var(--mut)] mb-1">
                            {isTr
                              ? 'Profil fotoğrafı URL (isteğe bağlı)'
                              : 'Avatar photo URL (optional)'}
                          </label>
                          <input
                            type="url"
                            value={profilePhotoUrl}
                            onChange={(e) => {
                              setProfilePhotoUrl(e.target.value);
                              if (profileError) setProfileError(null);
                            }}
                            placeholder="https://..."
                            maxLength={1000}
                            className="well-3d w-full rounded-xl px-3 h-9.5 outline-none text-sm text-[var(--tx)] placeholder:text-[var(--mut)]/65 focus:border-[var(--tx)]/45 transition-colors"
                          />
                        </div>
                      </div>

                      {profileError && (
                        <p className="text-xs text-red-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{profileError}</span>
                        </p>
                      )}

                      {profileSaved && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{profileSaved}</span>
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-0.5">
                        <span className="text-[11px] text-[var(--mut)]">
                          {isTr
                            ? 'Kenar çubuğu ve karşılama mesajında görünür.'
                            : 'Shown in the sidebar and welcome greeting.'}
                        </span>
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer disabled:opacity-45 shrink-0"
                        >
                          {savingProfile ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{isTr ? 'Profili kaydet' : 'Save profile'}</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : activeTab === 'commands' ? (
                  <motion.div
                    key="settings-commands-panel"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: LIQUID_EASE }}
                    className="space-y-6"
                  >
                    {/* Add / Edit Command Form */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {editingId
                            ? isTr
                              ? 'Komutu düzenle'
                              : 'Edit command'
                            : isTr
                              ? 'Yeni komut ekle'
                              : 'Add a command'}
                        </h3>
                        {editingId && (
                          <button
                            type="button"
                            onClick={resetForm}
                            className="text-xs text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                          >
                            {isTr ? 'Vazgeç' : 'Cancel edit'}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--mut)] mb-1">
                            {isTr ? 'Komut adı' : 'Command name'}
                          </label>
                          <div className="well-3d flex items-center rounded-xl px-3 h-9.5 focus-within:border-[var(--tx)]/45 transition-colors">
                            <span className="font-mono text-sm text-[var(--mut)] select-none mr-0.5">
                              /
                            </span>
                            <input
                              type="text"
                              value={nameInput}
                              onChange={(e) => {
                                setNameInput(e.target.value);
                                if (formError) setFormError(null);
                              }}
                              placeholder={isTr ? 'ornek-komut' : 'email'}
                              maxLength={32}
                              className="w-full bg-transparent border-0 outline-none text-sm font-mono text-[var(--tx)] placeholder:text-[var(--mut)]/65"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[var(--mut)] mb-1">
                            {isTr ? 'Kısa açıklama (isteğe bağlı)' : 'Short description (optional)'}
                          </label>
                          <input
                            type="text"
                            value={descInput}
                            onChange={(e) => setDescInput(e.target.value)}
                            placeholder={
                              isTr
                                ? 'Örn. Kısa ve nazik bir e-posta yaz'
                                : 'e.g. Draft a concise reply'
                            }
                            maxLength={140}
                            className="well-3d w-full rounded-xl px-3 h-9.5 outline-none text-sm text-[var(--tx)] placeholder:text-[var(--mut)]/65 focus:border-[var(--tx)]/45 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <label className="text-[11px] font-medium text-[var(--mut)]">
                            {isTr ? 'Komut yönergesi' : 'Prompt instruction'}
                          </label>
                          <span className="text-[11px] text-[var(--mut)]">
                            {isTr
                              ? 'Yazdığın metnin yerleşeceği yer için {input} kullanabilirsin'
                              : 'Use {input} where your message text should go'}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={promptInput}
                          onChange={(e) => {
                            setPromptInput(e.target.value);
                            if (formError) setFormError(null);
                          }}
                          placeholder={
                            isTr
                              ? 'Şu notlara göre kısa ve net bir e-posta taslağı hazırla:\n{input}'
                              : 'Write a clear, concise email based on these notes:\n{input}'
                          }
                          maxLength={2000}
                          className="well-3d w-full rounded-xl px-3 py-2.5 outline-none text-sm leading-relaxed text-[var(--tx)] placeholder:text-[var(--mut)]/65 resize-none focus:border-[var(--tx)]/45 transition-colors"
                        />
                      </div>

                      {formError && (
                        <p className="text-xs text-red-500">{formError}</p>
                      )}

                      {savedNotice && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>{savedNotice}</span>
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-0.5">
                        <span className="text-[11px] text-[var(--mut)]">
                          {nameInput.trim()
                            ? `${isTr ? 'Önizleme:' : 'Trigger:'} /${normalizeCommandName(nameInput) || '...'}`
                            : isTr
                              ? 'Sohbette / yazarak komut menüsünü açabilirsin.'
                              : 'Type / in the chat bar to use any command.'}
                        </span>
                        <button
                          type="submit"
                          disabled={saving}
                          className="btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer disabled:opacity-45"
                        >
                          {editingId ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{isTr ? 'Değişiklikleri kaydet' : 'Save changes'}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isTr ? 'Komut ekle' : 'Add command'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Custom Commands List */}
                    <div className="pt-5 border-t border-[var(--bd)] space-y-3">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold">
                          {isTr ? 'Senin komutların' : 'Your commands'}
                        </h3>
                        <span className="text-[11px] text-[var(--mut)]">
                          {customCommands.length}
                        </span>
                      </div>

                      {customCommands.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs text-[var(--mut)] leading-relaxed">
                            {isTr
                              ? 'Henüz özel bir komutun yok. Yukarıdan kendi komutunu ekleyebilir veya şu örneklerden biriyle başlayabilirsin:'
                              : 'No custom commands yet. Create one above, or add a quick starter:'}
                          </p>
                          <div className="divide-y divide-[var(--bd)]/75 border-y border-[var(--bd)]/75">
                            {starters.map((tpl) => (
                              <div
                                key={tpl.name}
                                className="py-2.5 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <span className="font-mono text-xs font-semibold text-[var(--tx)]">
                                    /{tpl.name}
                                  </span>
                                  <p className="text-xs text-[var(--mut)] truncate mt-0.5">
                                    {tpl.description}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void handleQuickAddStarter(tpl)}
                                  className="btn-3d-soft px-3 py-1.5 rounded-full text-xs font-medium shrink-0 cursor-pointer"
                                >
                                  {isTr ? 'Ekle' : 'Add'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--bd)]/80 border-y border-[var(--bd)]/80">
                          {customCommands.map((cmd) => (
                            <div
                              key={cmd.id}
                              className="py-3 flex items-start justify-between gap-3 group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-semibold text-[var(--tx)]">
                                    /{cmd.name}
                                  </span>
                                  {cmd.description && (
                                    <span className="text-xs text-[var(--mut)]">
                                      {cmd.description}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[var(--mut)]/85 mt-1 line-clamp-2 leading-relaxed">
                                  {cmd.prompt}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(cmd)}
                                  title={isTr ? 'Düzenle' : 'Edit'}
                                  className="p-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingId === cmd.id) resetForm();
                                    void onDeleteCommand(cmd.id);
                                  }}
                                  title={isTr ? 'Sil' : 'Delete'}
                                  className="p-1.5 rounded-lg text-[var(--mut)] hover:text-red-500 hover:bg-[var(--surf)] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Built-in Commands Reference */}
                    <div className="pt-5 border-t border-[var(--bd)] space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-[var(--mut)]" />
                        <h3 className="text-xs font-semibold text-[var(--mut)]">
                          {isTr ? 'Hazır komutlar' : 'Built-in commands'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
                        {builtIns.map((cmd) => (
                          <div
                            key={cmd.id}
                            className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[var(--bd)]/55 text-xs"
                          >
                            <span className="font-mono font-medium text-[var(--tx)] shrink-0">
                              /{cmd.name}
                            </span>
                            <span className="text-[var(--mut)] truncate text-right">
                              {cmd.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="settings-general-panel"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: LIQUID_EASE }}
                    className="divide-y divide-[var(--bd)]/80"
                  >
                    {/* Appearance */}
                    <div className="py-4 first:pt-0 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {isTr ? 'Görünüm' : 'Appearance'}
                        </p>
                        <p className="text-xs text-[var(--mut)] mt-0.5">
                          {theme === 'dark'
                            ? isTr
                              ? 'Koyu tema etkin'
                              : 'Dark theme active'
                            : isTr
                              ? 'Açık tema etkin'
                              : 'Light theme active'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleTheme}
                        className="btn-3d-soft inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer"
                      >
                        {theme === 'dark' ? (
                          <>
                            <Sun className="w-3.5 h-3.5" />
                            <span>{isTr ? 'Açık tema' : 'Switch to light'}</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-3.5 h-3.5" />
                            <span>{isTr ? 'Koyu tema' : 'Switch to dark'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Language */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {isTr ? 'Dil' : 'Language'}
                        </p>
                        <p className="text-xs text-[var(--mut)] mt-0.5">
                          {isTr
                            ? 'Arayüz ve hazır komut açıklamaları'
                            : 'Interface and built-in command labels'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeLang(lang === 'tr' ? 'en' : 'tr')}
                        className="btn-3d-soft inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}</span>
                      </button>
                    </div>

                    {/* Typography Selector */}
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {isTr ? 'Yazı tipi' : 'Typography'}
                        </p>
                        <p className="text-xs text-[var(--mut)] mt-0.5">
                          {isTr
                            ? 'Editoryal Serif + Sans, yalın Sans veya tam Serif (Türkçe tam uyumlu)'
                            : 'Editorial Serif + Sans (Auto), clean Jakarta Sans, or full Source Serif'}
                        </p>
                      </div>
                      <div className="segmented-track-3d inline-flex items-center gap-1 p-1 rounded-full shrink-0 self-start sm:self-auto">
                        {(
                          [
                            { id: 'auto', label: isTr ? 'Otomatik' : 'Auto' },
                            { id: 'jakarta', label: 'Sans' },
                            { id: 'serif', label: 'Serif' },
                          ] as const
                        ).map((opt) => {
                          const normalizedPref = fontPref === 'tr-sans' ? 'jakarta' : fontPref;
                          const active = normalizedPref === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => onChangeFontPref(opt.id)}
                              className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer whitespace-nowrap ${
                                active
                                  ? 'segmented-thumb-3d text-[var(--tx)] font-semibold'
                                  : 'text-[var(--mut)] hover:text-[var(--tx)] font-medium'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Connectors */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {isTr ? 'Google Workspace bağlayıcıları' : 'Google Workspace connectors'}
                        </p>
                        <p className="text-xs text-[var(--mut)] mt-0.5 truncate">
                          {workspaceConnected
                            ? workspaceEmail || (isTr ? 'Bağlı' : 'Connected')
                            : isTr
                              ? 'Gmail, Takvim, Drive, Dokümanlar ve Görevler'
                              : 'Gmail, Calendar, Drive, Docs, and Tasks'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenConnectors();
                        }}
                        className="btn-3d-soft inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium shrink-0 cursor-pointer"
                      >
                        <ConnectorsIcon className="w-3.5 h-3.5" />
                        <span>{isTr ? 'Yönet' : 'Manage'}</span>
                      </button>
                    </div>

                    {/* Account summary */}
                    {user && (
                      <div className="py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {isTr ? 'Hesap' : 'Account'}
                          </p>
                          <p className="text-xs text-[var(--mut)] mt-0.5 truncate">
                            {user.displayName ? `${user.displayName} · ` : ''}
                            {user.email || ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('profile')}
                          className="btn-3d-soft px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 cursor-pointer"
                        >
                          {isTr ? 'Profili düzenle' : 'Edit profile'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
