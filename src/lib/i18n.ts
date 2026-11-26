import type { ChatModelId } from './models';

export type Language = 'en' | 'tr';

export interface Translations {
  common: {
    close: string;
    newChat: string;
    defaultUser: string;
    loading: string;
  };
  app: {
    emailVerifiedBanner: string;
    emailVerifyErrorBanner: string;
  };
  models: Record<
    ChatModelId,
    {
      tagline: string;
      description: string;
    }
  >;
  nav: {
    whatItDoes: string;
    depths: string;
    benchmarks: string;
    api: string;
    faq: string;
    toggleTheme: string;
    signIn: string;
    start: string;
    chooseLanguage: string;
  };
  landing: {
    poweredBy: string;
    heroTitleLine1: string;
    heroTitleLine2: string;
    heroSubtitle: string;
    startFree: string;
    benchmarksCta: string;
    demoConversations: { q: string; a: string }[];
    sidebarMockTitle: string;
    familyEyebrow: string;
    familyTitle: string;
    familySubtitle: string;
    compareBenchmarks: string;
    showcaseEyebrow: string;
    showcaseTitle: string;
    showcaseCards: {
      reasoningKicker: string;
      reasoningTitle: string;
      reasoningDesc: string;
      reasoningAlt: string;
      codingKicker: string;
      codingTitle: string;
      codingDesc: string;
      codingAlt: string;
    };
    heroImageAlt: string;
    depthsImageAlt: string;
    heroThinkingBadge: string;
    timelineTitle: string;
    timelineItems: {
      time: string;
      title: string;
      prompt: string;
      answer: string;
    }[];
    depthsTitle: string;
    depthsSubtitle: string;
    depthPrompt: string;
    depthAnswers: {
      title: string;
      desc: string;
      width: string;
      text: string;
    }[];
    checklistTitle: string;
    checklistItems: string[];
    mockSearchPlaceholder: string;
    mockPinnedTitle: string;
    mockNote1: string;
    mockNote2: string;
    mockNote3: string;
    faqTitle: string;
    faqs: { q: string; a: string }[];
    getStartedNow: string;
    footerTagline: string;
    footerNavHeading: string;
    footerBackToTop: string;
    footerLegalHeading: string;
    footerPrivacy: string;
    footerTerms: string;
    footerKvkk: string;
    footerCopyright: string;
  };
  benchmarks: {
    backToHome: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    testYourself: string;
    takeaways: {
      ultra12: string;
      ultra11: string;
      pro11: string;
      low11: string;
    };
    tabs: {
      all: string;
      general: string;
      coding: string;
      math: string;
      speed: string;
    };
    legendLongclaw: string;
    legendOthers: string;
    cards: Record<
      string,
      {
        title: string;
        subtitle: string;
        unit: string;
        note: string;
      }
    >;
    tableTitle: string;
    tableSubtitle: string;
    scrollHint: string;
    colModel: string;
    colSpeed: string;
    speedUnit: string;
    methodologyNote: string;
    startChatting: string;
  };
  auth: {
    titleForgot: string;
    titleDefault: string;
    titleSignIn: string;
    titleSignUp: string;
    subtitle: string;
    subtitleSignIn: string;
    subtitleSignUp: string;
    showPassword: string;
    hidePassword: string;
    passwordMinHint: string;
    backToSignIn: string;
    forgotDesc: string;
    emailPlaceholder: string;
    sending: string;
    sendVerificationEmail: string;
    haveCodePrompt: string;
    verificationStepTitle: string;
    verificationStepVerified: (email: string) => string;
    verificationStepDefault: string;
    codePlaceholder: string;
    newPasswordPlaceholder: string;
    verifying: string;
    verifyAndUpdatePassword: string;
    resendVerificationEmail: string;
    continueWithGoogle: string;
    continueWithApple: string;
    orWithEmail: string;
    tabSignIn: string;
    tabSignUp: string;
    namePlaceholder: string;
    emailShortPlaceholder: string;
    passwordPlaceholder: string;
    forgotPasswordLink: string;
    tosPrefix: string;
    tosTerms: string;
    tosAnd: string;
    tosPrivacy: string;
    tosSuffix: string;
    processing: string;
    createAccount: string;
    signInBtn: string;
    footerSecurity: string;
    errors: {
      popupClosed: string;
      accountExistsDifferentCred: string;
      googleGeneric: string;
      applePopupClosed: string;
      appleNotAllowed: string;
      appleGeneric: string;
      invalidEmail: string;
      shortPassword: string;
      acceptTos: string;
      accountCreatedInfo: string;
      emailInUse: string;
      invalidCredential: string;
      userNotFound: string;
      operationNotAllowed: string;
      genericAuth: string;
      invalidEmailReset: string;
      resetSentInfo: (email: string) => string;
      resetUserNotFound: string;
      resetSendFailed: (msg: string) => string;
      missingResetCode: string;
      shortNewPassword: string;
      resetSuccessInfo: (email: string) => string;
      expiredActionCode: string;
      invalidActionCode: string;
      resetVerifyFailed: string;
    };
  };
  legal: {
    close: string;
    docs: {
      gizlilik: { title: string; content: string[] };
      sartlar: { title: string; content: string[] };
      kvkk: { title: string; content: string[] };
    };
  };
  chat: {
    suggestions: string[];
    emptyWorkspace: {
      greetingMorning: (name: string) => string;
      greetingAfternoon: (name: string) => string;
      greetingEvening: (name: string) => string;
      subtitle: string;
      tabs: {
        everyday: string;
        write: string;
        code: string;
        gmail: string;
      };
      starters: {
        everyday: Array<{ title: string; subtitle: string; prompt: string }>;
        write: Array<{ title: string; subtitle: string; prompt: string }>;
        code: Array<{ title: string; subtitle: string; prompt: string }>;
        gmail: Array<{ title: string; subtitle: string; prompt: string }>;
      };
      gmailPromptConnectTitle: string;
      gmailPromptConnectDesc: string;
      gmailConnectAction: string;
      gmailBrowseAction: string;
      gmailConnectedLabel: string;
      gmailDisconnectedLabel: string;
      quickActionsTitle: string;
      uploadFileTitle: string;
      uploadFileDesc: string;
      connectorsCardTitle: string;
      connectorsCardDescConnected: string;
      connectorsCardDescDisconnected: string;
      recentChatsTitle: string;
      messagesCount: (count: number) => string;
    };
    backToLandingTitle: string;
    closeMenuAria: string;
    newChatTitle: string;
    searchPlaceholder: string;
    searchTitle: string;
    noResults: string;
    noChatsYet: string;
    unpinTitle: string;
    pinTitle: string;
    renameTitle: string;
    deleteTitle: string;
    emailVerified: string;
    emailUnverified: string;
    switchToLight: string;
    switchToDark: string;
    switchLanguageLabel: string;
    signOut: string;
    deleteAccountConfirm: string;
    deleteAccount: string;
    openSidebarAria: string;
    sidebarLabel: string;
    hideSidebar: string;
    showSidebar: string;
    depthFast: string;
    depthFastTitle: string;
    depthMid: string;
    depthMidTitle: string;
    depthDeep: string;
    depthDeepTitle: string;
    exportMarkdownTitle: string;
    emailUnverifiedBanner: (email: string) => string;
    emailVerificationSent: string;
    emailSendFailed: string;
    sendVerification: string;
    emailStillUnverified: string;
    checkAgain: string;
    helloUser: (name: string) => string;
    defaultFriendName: string;
    emptySubtitle: string;
    thoughtsLabel: string;
    secondsShort: string;
    copied: string;
    copy: string;
    regenerate: string;
    thinking: string;
    inputPlaceholder: string;
    attachFileTitle: string;
    selectModelTitle: string;
    modelSelectionAria: string;
    chooseModel: string;
    otherModels: string;
    stopTitle: string;
    sendTitle: string;
    composerHint: string;
    effortLow: string;
    effortBalanced: string;
    effortHigh: string;
    stoppedFallback: string;
    readBodyError: string;
    streamError: string;
    noResponseFallback: string;
    chatErrorMessage: (msg: string) => string;
    connectionError: string;
    fileLabel: string;
    exportUserLabel: string;
    voice: {
      startTitle: string;
      stopTitle: string;
      cancelTitle: string;
      listeningLabel: string;
      transcribingLabel: string;
      permissionDenied: string;
      noMicrophone: string;
      notSupported: string;
      emptyTranscript: string;
      transcribeFailed: string;
      maxDurationReached: string;
    };
    voiceChat: {
      openTitle: string;
      title: string;
      tapToSpeak: string;
      listening: string;
      transcribing: string;
      thinking: string;
      speaking: string;
      tapToStop: string;
      interrupt: string;
      handsFree: string;
      mute: string;
      unmute: string;
      eyeAuto: string;
      eyeRound: string;
      eyeOval: string;
      eyeSquare: string;
      voiceLabel: string;
      quickCommands: string[];
    };
    codePreview: {
      openResult: string;
      copyCode: string;
      copiedCode: string;
      liveResultTitle: string;
      previewTab: string;
      codeTab: string;
      consoleTab: string;
      rerunTitle: string;
      downloadTitle: string;
      expandTitle: string;
      restoreTitle: string;
      closeTitle: string;
      desktopView: string;
      mobileView: string;
      clearConsole: string;
      noConsoleOutput: string;
    };
    connectors: {
      title: string;
      subtitle: string;
      openButtonTitle: string;
      gmailName: string;
      gmailDesc: string;
      connectedAs: (email: string) => string;
      notConnected: string;
      signInWithGoogle: string;
      connecting: string;
      disconnect: string;
      useInChatLabel: string;
      useInChatHint: string;
      inboxTab: string;
      composeTab: string;
      searchPlaceholder: string;
      searchButton: string;
      refreshTitle: string;
      loadingInbox: string;
      emptyInbox: string;
      unreadLabel: string;
      attachToChat: string;
      replyButton: string;
      toLabel: string;
      toPlaceholder: string;
      subjectLabel: string;
      subjectPlaceholder: string;
      bodyLabel: string;
      bodyPlaceholder: string;
      saveDraftButton: string;
      sendEmailButton: string;
      confirmSendTitle: string;
      confirmDraftTitle: string;
      confirmSendDesc: string;
      confirmDraftDesc: string;
      confirmSendButton: string;
      confirmDraftButton: string;
      cancelButton: string;
      sending: string;
      savingDraft: string;
      sentSuccess: string;
      draftSavedSuccess: string;
      missingFieldsError: string;
      sessionExpired: string;
      connectFailed: string;
      draftCardTitle: string;
      reviewAndSaveDraft: string;
      reviewAndSend: string;
      connectToSendHint: string;
      readingGmailStatus: string;
    };
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  tr: {
    common: {
      close: 'Kapat',
      newChat: 'Yeni sohbet',
      defaultUser: 'Kullanıcı',
      loading: 'Yükleniyor...',
    },
    app: {
      emailVerifiedBanner: 'E-posta adresiniz başarıyla doğrulandı!',
      emailVerifyErrorBanner: 'E-posta doğrulama bağlantısı geçersiz veya süresi dolmuş.',
    },
    models: {
      'longclaw-clawing-1.2-ultra': {
        tagline: 'Derin Analiz',
        description: 'Zor problemler, araştırma ve çok adımlı mantık için en güçlü model.',
      },
      'longclaw-clawing-1.2-pro': {
        tagline: 'Günlük',
        description: 'Kod, yazı ve günlük işler için hızlı ve dengeli.',
      },
      'longclaw-clawing-1.1-ultra': {
        tagline: 'Ultra',
        description: 'Uzun metinler ve detaylı karşılaştırmalar için.',
      },
      'longclaw-clawing-1.1-pro': {
        tagline: 'Pro',
        description: 'Uzun bağlamda tutarlı, kod ve yazıda net.',
      },
      'longclaw-clawing-1-pro': {
        tagline: 'Klasik Pro',
        description: 'Sade üsluplu, düzenli teknik ve yazı işleri için.',
      },
      'longclaw-clawing-1.1-low': {
        tagline: 'Anlık',
        description: 'Kısa sorular, çeviri ve anında yanıtlar için en hızlı seçenek.',
      },
      'longclaw-clawing-1.1': {
        tagline: 'Standart',
        description: 'Doğal sohbet ve sade açıklamalar için.',
      },
    },
    nav: {
      whatItDoes: 'Komutlar',
      depths: 'Derinlikler',
      benchmarks: 'Ölçümler',
      api: 'API',
      faq: 'SSS',
      toggleTheme: 'Temayı değiştir',
      signIn: 'Giriş yap',
      start: 'Başla',
      chooseLanguage: 'Dil seçin',
    },
    landing: {
      poweredBy: 'Longclaw AI',
      heroTitleLine1: 'Daha hızlı düşün.',
      heroTitleLine2: 'Her şeyi üret.',
      heroSubtitle: 'Sohbet, kod, görsel ve Google araçların tek bir yerde.',
      startFree: 'Ücretsiz başla',
      benchmarksCta: 'Ölçümler',
      demoConversations: [
        {
          q: 'Son üç e-postamdaki önemli noktaları özetle',
          a: '1. Tasarım toplantısı Perşembe 14:00’e alındı. 2. Bütçe onaylandı. 3. Ana sayfa metni için onayın bekleniyor.',
        },
        {
          q: 'Burada deneyebileceğim sade bir kronometre yaz',
          a: 'Canlı önizleme panelinde hazır — sohbetin hemen yanında başlatıp test edebilirsin.',
        },
        {
          q: '/takvim Yarın 10:00’a ekip toplantısı ekle',
          a: '"Ekip Toplantısı" yarın 10:00–11:00 için takvimine eklendi.',
        },
      ],
      sidebarMockTitle: 'Çalışma Alanı',
      familyEyebrow: 'Modeller',
      familyTitle: 'Hızını seç.',
      familySubtitle: 'Sohbet içinden istediğin an model değiştir.',
      compareBenchmarks: 'Tüm test sonuçlarını gör',
      showcaseEyebrow: 'Çalışma Alanı',
      showcaseTitle: 'Sade ve hızlı araçlar.',
      showcaseCards: {
        reasoningKicker: '01 · Akıl Yürütme',
        reasoningTitle: 'Nasıl düşündüğünü gör.',
        reasoningDesc: 'Karmaşık sorularda adım adım düşünce akışını tek tıkla aç.',
        reasoningAlt: 'Minimalist çalışma ortamı ve notlar',
        codingKicker: '02 · Canlı Önizleme',
        codingTitle: 'Kodu anında çalıştır.',
        codingDesc: 'HTML, arayüz ve görselleri sohbetin hemen yanında test et.',
        codingAlt: 'Canlı kod geliştirme görünümü',
      },
      heroImageAlt: 'Gün doğumunda sakin Alp dağları ve sisli ufuk manzarası',
      depthsImageAlt: 'Üç farklı derinlik düzeyini simgeleyen minimalist optik cam prizmalar',
      heroThinkingBadge: 'Longclaw',
      timelineTitle: '/ yaz, doğrudan yap.',
      timelineItems: [
        {
          time: '/gmail',
          title: 'E-posta gönder',
          prompt: '/gmail Proje özetini Maya’ya gönder',
          answer: 'Gmail hesabından gönderildi.',
        },
        {
          time: '/takvim',
          title: 'Etkinlik ekle',
          prompt: '/takvim Cuma 13:00’te öğle yemeği ekle',
          answer: 'Google Takvim’e eklendi.',
        },
        {
          time: '/drive',
          title: 'Dosya bul',
          prompt: '/drive Q4 sunumunu bul',
          answer: 'Google Drive dosyan bulundu ve getirildi.',
        },
        {
          time: '/döküman',
          title: 'Doküman oluştur',
          prompt: '/döküman Yayın kontrol listesi hazırla',
          answer: 'Yeni Google Dokümanı oluşturuldu.',
        },
        {
          time: '/görev',
          title: 'Görev kaydet',
          prompt: '/görev Pazartesiden önce alan adını yenile',
          answer: 'Google Görevler’e eklendi.',
        },
      ],
      depthsTitle: 'Kısa yanıt ya da tam analiz.',
      depthsSubtitle: 'Her soru için Hızlı, Orta veya Derin seç.',
      depthPrompt: 'Yeni bir yazılım ürününü nasıl fiyatlandırmalıyım?',
      depthAnswers: [
        {
          title: 'Hızlı',
          desc: 'Tek satır, net cevap.',
          width: '30%',
          text: 'Sunucu maliyetine göre değil, kullanıcıya kazandırdığın zamana ve değere göre 2–3 sade paket oluştur.',
        },
        {
          title: 'Orta',
          desc: 'Dengeli özet ve öneri.',
          width: '65%',
          text: 'Maliyete göre fiyat koyma. Ürününün her ay ne kadar zaman veya para tasarrufu sağladığına bak ve bunun %10–20’sini hedefle.\n\nDeneme için ücretsiz bir paket, net bir Pro plan ve ekipler için ayrı bir plan yeterli.',
        },
        {
          title: 'Derin',
          desc: 'Adım adım tam plan.',
          width: '100%',
          text: '1. Değer ölçütü: Fiyatı müşterinin başarısıyla büyüyen bir birime bağla (kullanıcı sayısı, proje veya kullanım).\n2. Paket yapısı: Keşif için Ücretsiz, bireysel işler için Pro, ortak çalışma için Ekip paketi.\n3. Erken test: Yıllık ödemede %20 indirim sun; dönüşüm %5’in üzerinde kaldıkça yeni kullanıcılar için fiyatı kademeli artır.',
        },
      ],
      checklistTitle: 'Neler var?',
      checklistItems: [
        'Google, Apple ve e-posta ile giriş',
        'Masaüstü ve mobilde otomatik eşitleme',
        '/gmail, /takvim, /drive, /döküman ve /görev komutları',
        'Ayarlar’dan özel /komut ekleme',
        'Hızlı, Orta ve Derin düşünme modları',
        'Canlı kod önizleme paneli',
        'Görsel yükleme ve yeni görsel üretme',
        'Sohbet sabitleme ve hızlı arama',
        'Sade siyah-beyaz açık ve koyu temalar',
      ],
      mockSearchPlaceholder: 'sohbetlerde ara...',
      mockPinnedTitle: 'Ürün yol haritası',
      mockNote1: 'API mimarisi',
      mockNote2: 'Sprint planı',
      mockNote3: 'Yayın listesi',
      faqTitle: 'Sorular',
      faqs: [
        {
          q: 'Ücretsiz mi?',
          a: 'Evet. Hesap açıp hemen kullanmaya başlayabilirsin.',
        },
        {
          q: 'Google komutları nasıl çalışır?',
          a: 'Bağlayıcılar’dan Google hesabını bağla, sonra sohbette /gmail, /takvim, /drive, /döküman veya /görev yaz.',
        },
        {
          q: 'Kendi komutumu ekleyebilir miyim?',
          a: 'Evet. Ayarlar’dan kendi /komut kısayollarını tanımlayıp kaydedebilirsin.',
        },
        {
          q: 'Sohbetlerimi silebilir miyim?',
          a: 'İstediğin sohbeti tek tıkla ya da hesabınla birlikte tamamen silebilirsin.',
        },
      ],
      getStartedNow: 'Hemen başla',
      footerTagline: 'Sohbet, kod, görsel ve komutlar tek bir yerde.',
      footerNavHeading: 'Sayfalar',
      footerBackToTop: 'Yukarı çık',
      footerLegalHeading: 'Yasal',
      footerPrivacy: 'Gizlilik Politikası',
      footerTerms: 'Kullanım Şartları',
      footerKvkk: 'KVKK Aydınlatma Metni',
      footerCopyright: 'Longclaw © 2026',
    },
    benchmarks: {
      backToHome: 'Ana sayfaya dön',
      eyebrow: 'Ölçüm Notları · Kasım 2026',
      title: 'Sayılarla gerçekçi bir kıyaslama.',
      subtitle:
        'Longclaw modellerini Türkçe dil hakimiyeti, genel bilgi, kodlama, matematik ve akış hızı testlerinde yaygın modellerle aynı koşullarda ölçtük.',
      testYourself: 'Kendin dene',
      takeaways: {
        ultra12:
          'MMLU-Pro (%84.6) ve GPQA Diamond (%71.4) testlerinde öne çıkıyor; uzun ve çok adımlı sorularda en yüksek tutarlılık.',
        ultra11:
          'Türkçe anlatım (%86.8) ve kurallara sadık kalmada oldukça dengeli; uzun araştırma notları için güvenilir.',
        pro11:
          '%61.2 LiveCodeBench ve 88 tok/s hızıyla günlük kodlama ve yazı işlerinde bekletmeyen Pro seçeneği.',
        low11:
          '184 tok/s akış hızı ve %79.8 Türkçe doğruluğuyla küçük ve acil işler için en çevik model.',
      },
      tabs: {
        all: 'Tümü',
        general: 'Türkçe & Bilgi',
        coding: 'Kodlama',
        math: 'Matematik & Mantık',
        speed: 'Hız & Uyum',
      },
      legendLongclaw: 'Longclaw modelleri',
      legendOthers: 'Diğer modeller',
      cards: {
        'tr-bench': {
          title: 'TR-Bench (Türkçe Anlama & Nüans)',
          subtitle: 'Deyim, resmi dil, özetleme ve bağlam tutarlılığı değerlendirmesi',
          unit: '%',
          note: '5-shot · İnsan değerlendirmesi + otomatik doğrulama',
        },
        'mmlu-pro': {
          title: 'MMLU-Pro',
          subtitle: '14 farklı akademik ve mesleki alanda çoktan seçmeli genel bilgi',
          unit: '%',
          note: 'Zero-shot CoT · 10 seçenekli zorlu set',
        },
        livecodebench: {
          title: 'LiveCodeBench',
          subtitle: 'Güncel yarışma ve algoritma problemlerinde tek denemede çözüm oranı',
          unit: '%',
          note: 'Pass@1 · Zaman sızıntısı olmayan güncel problemler',
        },
        'swe-bench': {
          title: 'SWE-bench Verified',
          subtitle: 'Gerçek açık kaynak kod depolarında hata tespiti ve yama üretimi',
          unit: '%',
          note: 'Agentless harness · 500 doğrulanmış GitHub görevi',
        },
        'math-500': {
          title: 'MATH-500',
          subtitle: 'Lise ve olimpiyat seviyesinde çok adımlı matematiksel akıl yürütme',
          unit: '%',
          note: 'Zero-shot · Adım adım çözüm doğrulaması',
        },
        'gpqa-diamond': {
          title: 'GPQA Diamond',
          subtitle: 'Fizik, kimya ve biyolojide doktora düzeyinde muhakeme soruları',
          unit: '%',
          note: 'Zero-shot · Uzmanların bile zorlandığı alt küme',
        },
        ifeval: {
          title: 'IFEval (Talimat Uyumu)',
          subtitle: 'Biçim, uzunluk, ton ve kısıt kurallarına birebir sadık kalma oranı',
          unit: '%',
          note: 'Strict Prompt Accuracy · Günlük iş akışları için kritik metrik',
        },
        throughput: {
          title: 'Çıktı Hızı (Token / saniye)',
          subtitle: 'Orta efor seviyesinde saniyede üretilen ortalama token miktarı',
          unit: ' tok/s',
          note: 'Medyan akış hızı · Yüksek değer daha hızlıdır',
        },
      },
      tableTitle: 'Özet kıyaslama tablosu',
      tableSubtitle: 'Tüm modellerin temel değerlendirme setlerindeki puanları yan yana.',
      scrollHint: 'Tabloyu yana kaydır',
      colModel: 'Model',
      colSpeed: 'Hız',
      speedUnit: 'tok/s',
      methodologyNote:
        'Not: Longclaw skorları Orta/Derin düşünme eforu ayarında, rakip modeller ise kamuya açık standart API sürümleriyle aynı test protokolünde ölçülmüştür.',
      startChatting: 'Sohbete başla',
    },
    auth: {
      titleForgot: 'Şifre Yenileme',
      titleDefault: 'Longclaw’a Hoş Geldin',
      titleSignIn: 'Tekrar Hoş Geldin',
      titleSignUp: 'Hesabını Oluştur',
      subtitle: 'Kaldığın yerden devam et veya yeni bir hesap aç',
      subtitleSignIn: 'Sohbetlerine kaldığın yerden devam et',
      subtitleSignUp: 'Saniyeler içinde sakin çalışma alanını aç',
      showPassword: 'Şifreyi göster',
      hidePassword: 'Şifreyi gizle',
      passwordMinHint: 'En az 6 karakter',
      backToSignIn: 'Giriş ekranına dön',
      forgotDesc:
        'Hesabında kullandığın e-posta adresini yaz. Şifreni güvenle yenileyebilmen için bir doğrulama bağlantısı göndereceğiz.',
      emailPlaceholder: 'E-posta adresin',
      sending: 'Gönderiliyor...',
      sendVerificationEmail: 'Sıfırlama Bağlantısı Gönder',
      haveCodePrompt: 'Doğrulama kodun elinde mi? Buradan gir',
      verificationStepTitle: 'E-posta Doğrulama',
      verificationStepVerified: (email) =>
        `${email} doğrulandı. Şimdi yeni şifreni belirleyebilirsin.`,
      verificationStepDefault:
        'Gelen kutundaki bağlantıya tıklayabilir ya da bağlantıdaki kodu aşağıya yapıştırıp şifreni yenileyebilirsin.',
      codePlaceholder: 'Doğrulama kodu veya bağlantısı',
      newPasswordPlaceholder: 'Yeni şifre (en az 6 karakter)',
      verifying: 'Kontrol ediliyor...',
      verifyAndUpdatePassword: 'Şifreyi Güncelle',
      resendVerificationEmail: 'Bağlantıyı tekrar gönder',
      continueWithGoogle: 'Google ile devam et',
      continueWithApple: 'Apple ile giriş yap',
      orWithEmail: 'veya e-posta ile',
      tabSignIn: 'Giriş yap',
      tabSignUp: 'Kayıt ol',
      namePlaceholder: 'Adın',
      emailShortPlaceholder: 'E-posta',
      passwordPlaceholder: 'Şifre (en az 6 karakter)',
      forgotPasswordLink: 'Şifremi unuttum',
      tosPrefix: '',
      tosTerms: 'Kullanım Şartları',
      tosAnd: '’nı ve ',
      tosPrivacy: 'Gizlilik Politikası',
      tosSuffix: '’nı okudum, kabul ediyorum.',
      processing: 'Bekleniyor...',
      createAccount: 'Hesap oluştur',
      signInBtn: 'Giriş yap',
      footerSecurity: 'Sohbetlerin hesabın altında güvenle saklanır.',
      errors: {
        popupClosed: 'Giriş penceresi kapatıldı.',
        accountExistsDifferentCred:
          'Bu e-posta adresi başka bir giriş yöntemiyle kayıtlı görünüyor.',
        googleGeneric: 'Google ile giriş tamamlanamadı, tekrar dener misin?',
        applePopupClosed: 'Apple giriş penceresi kapatıldı.',
        appleNotAllowed: 'Apple ile giriş şu an etkin değil.',
        appleGeneric: 'Apple ile giriş sırasında bir sorun oluştu.',
        invalidEmail: 'Geçerli bir e-posta adresi yazar mısın?',
        shortPassword: 'Şifre en az 6 karakter olmalı.',
        acceptTos:
          'Devam etmeden önce Kullanım Şartları ve Gizlilik Politikasını onaylaman gerekiyor.',
        accountCreatedInfo:
          'Hesabın hazır! Gelen kutuna küçük bir doğrulama bağlantısı bıraktık.',
        emailInUse: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
        invalidCredential: 'E-posta ya da şifre eşleşmedi.',
        userNotFound: 'Bu e-posta ile kayıtlı bir hesap bulamadık.',
        operationNotAllowed:
          'E-posta ile giriş şu an kapalı görünüyor.',
        genericAuth: 'Bir şeyler ters gitti, lütfen tekrar dene.',
        invalidEmailReset:
          'Sıfırlama bağlantısı için geçerli bir e-posta adresi yaz.',
        resetSentInfo: (email) =>
          `${email} adresine sıfırlama bağlantısı gönderdik. Gelen kutuna göz at veya bağlantıdaki kodu aşağıya yapıştır.`,
        resetUserNotFound: 'Bu e-posta adresiyle kayıtlı bir hesap bulamadık.',
        resetSendFailed: (msg) => `Bağlantı gönderilemedi: ${msg}`,
        missingResetCode:
          'E-postadaki doğrulama kodunu veya bağlantıyı yapıştırır mısın?',
        shortNewPassword: 'Yeni şifren en az 6 karakter olmalı.',
        resetSuccessInfo: (email) =>
          `${email} için şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.`,
        expiredActionCode:
          'Bu doğrulama kodunun süresi dolmuş. Yeni bir bağlantı isteyebilirsin.',
        invalidActionCode: 'Kod geçersiz ya da daha önce kullanılmış.',
        resetVerifyFailed: 'Şifre yenileme doğrulanamadı.',
      },
    },
    legal: {
      close: 'Kapat',
      docs: {
        gizlilik: {
          title: 'Gizlilik Politikası',
          content: [
            'Bu metin, Longclaw’ı kullanırken hangi bilgilerin tutulduğunu ve nasıl korunduğunu sade bir dille anlatır.',
            'Neleri saklıyoruz? Giriş yaptığında adın, e-posta adresin, sohbet geçmişin ve tema/dil gibi kişisel tercihlerin güvenli bulut depolamada tutulur.',
            'Neden kullanıyoruz? Sohbetlerine telefonundan ve bilgisayarından kesintisiz ulaşabilmen, oturumunu güvende tutmamız ve sorduğun sorulara yanıt üretebilmemiz için.',
            'Paylaşım: Verilerin hiçbir zaman satılmaz, reklam veya pazarlama amacıyla üçüncü taraflarla paylaşılmaz.',
            'Silme hakkı: İstediğin sohbeti tek tıkla silebilir veya profil menüsünden hesabını ve tüm kayıtlarını kalıcı olarak kaldırabilirsin.',
          ],
        },
        sartlar: {
          title: 'Kullanım Şartları',
          content: [
            'Longclaw’a hoş geldin. Uygulamayı kullanarak aşağıdaki temel kuralları kabul etmiş olursun.',
            'Hizmet kapsamı: Longclaw; yazı yazma, not düzenleme, kodlama ve günlük araştırma işlerinde sana eşlik eden dijital bir çalışma alanıdır.',
            'Yanıtların doğruluğu: Yapay zekâ yanıtları zaman zaman eksik ya da hatalı olabilir. Sağlık, hukuk veya finans gibi kritik konularda uzman görüşü almayı ihmal etme.',
            'Doğru kullanım: Sistemi kötüye kullanmamak, zararlı içerik üretmemek ve diğer kullanıcıların güvenliğini riske atmamak herkesin sorumluluğudur.',
            'Hesap güvenliği: Giriş bilgilerini başkalarıyla paylaşmamak ve güvende tutmak hesabın sahibine aittir.',
          ],
        },
        kvkk: {
          title: 'KVKK Aydınlatma Metni',
          content: [
            '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında bilgilendirme metnidir.',
            'İşlenen veriler: Ad, e-posta adresi, oturum bilgileri ve uygulamada oluşturduğun sohbet kayıtları.',
            'İşleme amacı: Üyelik oluşturma, cihazlar arası sohbet eşitleme, yanıt üretme ve hesap güvenliğini sağlama.',
            'Saklama: Verilerin yalnızca hizmetin çalışması için gerekli olduğu sürece şifreli bulut altyapısında tutulur.',
            'Hakların: KVKK madde 11 uyarınca verilerine erişme, düzeltme isteme ve dilediğin an tamamen sildirme hakkına sahipsin.',
          ],
        },
      },
    },
    chat: {
      suggestions: [
        'Kuantum bilgisayarları günlük hayattan örnekle anlat',
        'Dağınık bir haftayı nasıl sakinleştiririm?',
        'Müşteriye içten ve kısa bir teşekkür maili yaz',
        'Bu metni üç net maddede özetle:',
      ],
      emptyWorkspace: {
        greetingMorning: (name) => `Günaydın, ${name}`,
        greetingAfternoon: (name) => `İyi günler, ${name}`,
        greetingEvening: (name) => `İyi akşamlar, ${name}`,
        subtitle: 'Aklında ne varsa yazabilir, bir dosya bırakabilir ya da aşağıdan bir konu seçebilirsin.',
        tabs: {
          everyday: 'Günlük',
          write: 'Yazı & Not',
          code: 'Kod',
          gmail: 'Gmail',
        },
        starters: {
          everyday: [
            {
              title: 'Kafa karıştıran bir konuyu sadeleştir',
              subtitle: 'Teknik jargona boğmadan, gerçek hayat örnekleriyle',
              prompt: 'Kuantum bilgisayarların mantığını günlük hayattan sade örneklerle anlat',
            },
            {
              title: 'Nefes aldıran bir hafta planla',
              subtitle: 'Odaklanma saatleri, toplantılar ve mola dengesiyle',
              prompt: 'Yoğun bir çalışma haftasında tükenmeden ilerlemek için gerçekçi bir haftalık plan kurmama yardım et',
            },
            {
              title: 'İki fikri karşılaştır',
              subtitle: 'Artıları, eksileri ve net bir öneriyle karar ver',
              prompt: 'Şu iki seçeneği artıları, eksileri ve gizli riskleriyle karşılaştır:',
            },
            {
              title: 'Hızlı bir öğrenme rotası',
              subtitle: 'Sıfırdan 14 günlük uygulamalı öğrenme programı',
              prompt: 'Sıfırdan başlamak isteyen biri için 14 günlük uygulamalı bir öğrenme planı hazırla:',
            },
          ],
          write: [
            {
              title: 'Samimi bir müşteri e-postası',
              subtitle: 'Kısa, profesyonel ve insan sıcaklığında teşekkür notu',
              prompt: 'Bir müşteriye iş birliği için teşekkür eden samimi, kısa ve doğal bir e-posta yaz',
            },
            {
              title: 'Üç maddelik net özet',
              subtitle: 'Uzun metni ana fikirlere ve aksiyonlara ayır',
              prompt: 'Bu metni üç ana maddede özetle ve varsa aksiyon adımlarını çıkar:',
            },
            {
              title: 'Metni daha akıcı hale getir',
              subtitle: 'Anlamı koruyarak gereksiz tekrarları temizle',
              prompt: 'Aşağıdaki metni anlamını bozmadan daha net, akıcı ve doğal bir Türkçeyle yeniden yaz:',
            },
            {
              title: 'Toplantı notlarını düzenle',
              subtitle: 'Kararlar, sorumlular ve sonraki adımlar tablosu',
              prompt: 'Şu dağınık toplantı notlarını kararlar ve sonraki adımlar halinde düzenle:',
            },
          ],
          code: [
            {
              title: 'Canlı önizlemeli mini arayüz',
              subtitle: 'Tek dosyada çalışan temiz bir Pomodoro zamanlayıcı',
              prompt: 'Temiz, modern ve minimalist bir Pomodoro zamanlayıcı arayüzünü tek bir HTML dosyasında yaz',
            },
            {
              title: 'Hata ayıkla ve açıkla',
              subtitle: 'Kök nedeni bulup doğrudan çalışan düzeltmeyi göster',
              prompt: 'Bu koddaki hatanın kök nedenini bul ve temiz bir çözüm öner:',
            },
            {
              title: 'Veri akışı diyagramı çiz',
              subtitle: 'Mermaid ile okunaklı mimari şeması oluştur',
              prompt: 'Modern bir web uygulamasının kimlik doğrulama ve API akışını Mermaid diyagramı olarak çiz',
            },
            {
              title: 'Kodu sadeleştir ve hızlandır',
              subtitle: 'Okunabilirlik ve performans odaklı refactor önerisi',
              prompt: 'Bu fonksiyonu daha okunabilir ve performanslı hale getir:',
            },
          ],
          gmail: [
            {
              title: 'Okunmamış mailleri özetle',
              subtitle: 'Önem sırasına göre kısa bir gelen kutusu özeti al',
              prompt: 'Okunmamış e-postalarımı önem sırasına göre kısaca özetle',
            },
            {
              title: 'Yanıt bekleyenleri bul',
              subtitle: 'Gözden kaçan önemli mesajları listele',
              prompt: 'Son gelen e-postalarımdan yanıt vermem gerekenleri listele',
            },
            {
              title: 'Faturaları ve siparişleri tara',
              subtitle: 'Son fatura, ödeme veya rezervasyon maillerini çıkar',
              prompt: 'Gelen kutumdaki son fatura, ödeme veya sipariş e-postalarını bulup özetle',
            },
            {
              title: 'Nazik bir yanıt taslağı hazırla',
              subtitle: 'Onayından sonra Gmail’e kaydet veya gönder',
              prompt: 'Son gelen önemli e-postama kısa ve nazik bir yanıt taslağı hazırla',
            },
          ],
        },
        gmailPromptConnectTitle: 'Gmail gelen kutunu sohbete bağla',
        gmailPromptConnectDesc:
          'İzninle okunmamış e-postalarını özetle, fatura veya mesaj ara ve onaylayarak taslak oluştur.',
        gmailConnectAction: 'Gmail’i bağla',
        gmailBrowseAction: 'Gelen kutusunu aç',
        gmailConnectedLabel: 'Gmail bağlı',
        gmailDisconnectedLabel: 'Gmail bağla',
        quickActionsTitle: 'Hızlı araçlar',
        uploadFileTitle: 'Dosya ekle',
        uploadFileDesc: 'Kod, CSV, Markdown veya metin dosyasını doğrudan analiz et',
        connectorsCardTitle: 'Gmail bağlayıcısı',
        connectorsCardDescConnected: 'Gelen kutunda ara, e-posta ekle veya yeni mesaj yaz',
        connectorsCardDescDisconnected: 'E-postalarını özetlemek ve taslak oluşturmak için bağla',
        recentChatsTitle: 'Kaldığın yerden devam et',
        messagesCount: (count) => `${count} mesaj`,
      },
      backToLandingTitle: 'Tanıtım sayfasına dön',
      closeMenuAria: 'Menüyü kapat',
      newChatTitle: 'Yeni sohbet',
      searchPlaceholder: 'Sohbetlerde ara',
      searchTitle: 'Sohbetlerde ara (Ctrl/⌘+Shift+F)',
      noResults: 'Sonuç bulunamadı',
      noChatsYet: 'Henüz sohbet yok',
      unpinTitle: 'Sabitlemeyi kaldır',
      pinTitle: 'Üste sabitle',
      renameTitle: 'Yeniden adlandır',
      deleteTitle: 'Sil',
      emailVerified: 'E-posta Doğrulandı',
      emailUnverified: 'E-posta Onaysız',
      switchToLight: 'Açık temaya geç',
      switchToDark: 'Koyu temaya geç',
      switchLanguageLabel: 'Dil: Türkçe (English’e geç)',
      signOut: 'Çıkış yap',
      deleteAccountConfirm: 'Emin misin? Tekrar tıkla',
      deleteAccount: 'Hesabı ve verileri sil',
      openSidebarAria: 'Kenar çubuğunu aç',
      sidebarLabel: 'Kenar çubuğu',
      hideSidebar: 'Kenar çubuğunu gizle',
      showSidebar: 'Kenar çubuğunu göster',
      depthFast: 'Hızlı',
      depthFastTitle: 'Hızlı mod: Düşük düşünme eforu ile hızlı ve doğrudan yanıtlar',
      depthMid: 'Orta',
      depthMidTitle: 'Orta mod: Dengeli düşünme eforu ve akıl yürütme',
      depthDeep: 'Derin',
      depthDeepTitle: 'Derin mod: Yüksek düşünme eforu ve kapsamlı analiz',
      exportMarkdownTitle: 'Sohbeti Markdown olarak kopyala',
      emailUnverifiedBanner: (email) => `E-posta adresiniz (${email}) henüz doğrulanmadı.`,
      emailVerificationSent:
        'Doğrulama bağlantısı tekrar gönderildi. Gelen kutunuzu kontrol edin.',
      emailSendFailed: 'E-posta gönderilemedi.',
      sendVerification: 'Doğrulama Gönder',
      emailStillUnverified:
        'Henüz doğrulanmamış görünüyor. Lütfen e-postanızdaki bağlantıya tıklayın.',
      checkAgain: 'Kontrol Et',
      helloUser: (name) => `Merhaba, ${name}`,
      defaultFriendName: 'Arkadaşım',
      emptySubtitle: 'Bir soru sor ya da aşağıdaki hazır önerilerden birini dene.',
      thoughtsLabel: 'Düşünce notları',
      secondsShort: 'sn',
      copied: 'Kopyalandı',
      copy: 'Kopyala',
      regenerate: 'Tekrar dene',
      thinking: 'Üzerine düşünüyor…',
      inputPlaceholder: 'Aklındakini yaz veya komutlar için / kullan...',
      attachFileTitle: 'Görsel veya dosya ekle',
      selectModelTitle: 'Kullanılacak modeli seç',
      modelSelectionAria: 'Model seçimi',
      chooseModel: 'Model seçin',
      otherModels: 'Diğer modeller',
      stopTitle: 'Yanıtı durdur',
      sendTitle: 'Gönder',
      composerHint: 'Enter ile gönder · Shift+Enter ile yeni satır',
      effortLow: 'Düşük Efor',
      effortBalanced: 'Dengeli Efor',
      effortHigh: 'Yüksek Efor',
      stoppedFallback: 'Yanıt durduruldu.',
      readBodyError: 'Response body okunamadı.',
      streamError: 'Yanıt üretilirken bir hata oluştu.',
      noResponseFallback: 'Yanıt alınamadı.',
      chatErrorMessage: (msg) => `Şu an yanıt veremedim: ${msg}. Lütfen tekrar deneyin.`,
      connectionError: 'Bağlantı hatası',
      fileLabel: 'Dosya',
      exportUserLabel: 'Sen',
      voice: {
        startTitle: 'Sesle yaz (Mikrofon)',
        stopTitle: 'Kaydı bitir ve metne dök',
        cancelTitle: 'Ses kaydını iptal et',
        listeningLabel: 'Dinliyor…',
        transcribingLabel: 'Ses yazıya çevriliyor…',
        permissionDenied: 'Mikrofon izni reddedildi. Tarayıcı ayarlarından mikrofona izin verip tekrar dene.',
        noMicrophone: 'Bağlı bir mikrofon bulunamadı.',
        notSupported: 'Bu tarayıcıda sesli giriş desteklenmiyor.',
        emptyTranscript: 'Konuşma algılanamadı. Tekrar dener misin?',
        transcribeFailed: 'Ses yazıya çevrilemedi. Lütfen tekrar dene.',
        maxDurationReached: 'Maksimum kayıt süresine ulaşıldı, ses yazıya çevriliyor…',
      },
      voiceChat: {
        openTitle: 'Sesli Sohbet (Animasyonlu Gözler)',
        title: 'Sesli Sohbet',
        tapToSpeak: 'Konuşmak için dokun',
        listening: 'Seni dinliyorum…',
        transcribing: 'Sesin çözülüyor…',
        thinking: 'Düşünüyor…',
        speaking: 'Konuşuyor…',
        tapToStop: 'Göndermek için dokun',
        interrupt: 'Sözünü kes',
        handsFree: 'Otomatik dinle',
        mute: 'Sesi kapat',
        unmute: 'Sesi aç',
        eyeAuto: 'Otomatik',
        eyeRound: 'Yuvarlak',
        eyeOval: 'Oval',
        eyeSquare: 'Kare',
        voiceLabel: 'Ses',
        quickCommands: [
          'Kare göz yap ve özyinelemeyi anlat',
          'Bana kısa bir şaka yap',
          'Oval göz yap ve rahatlamama yardım et',
          'Eğlenceli bir dans yap!',
        ],
      },
      codePreview: {
        openResult: 'Sonucu aç',
        copyCode: 'Kodu kopyala',
        copiedCode: 'Kopyalandı',
        liveResultTitle: 'Canlı Sonuç',
        previewTab: 'Önizleme',
        codeTab: 'Kod',
        consoleTab: 'Konsol',
        rerunTitle: 'Yeniden çalıştır',
        downloadTitle: 'Dosyayı indir',
        expandTitle: 'Tam ekran yap',
        restoreTitle: 'Yan panele dön',
        closeTitle: 'Önizlemeyi kapat',
        desktopView: 'Masaüstü görünüm',
        mobileView: 'Mobil görünüm (390px)',
        clearConsole: 'Temizle',
        noConsoleOutput: 'Henüz konsol çıktısı yok.',
      },
      connectors: {
        title: 'Bağlayıcılar',
        subtitle: 'İzninle harici araçlarını bağla; Longclaw gerçek verilerinle çalışsın.',
        openButtonTitle: 'Google Workspace Bağlayıcıları',
        gmailName: 'Gmail',
        gmailDesc: 'Gelen kutunu ara, e-postalarını özetle ve onayınla taslak oluşturup gönder.',
        connectedAs: (email) => `${email} bağlı`,
        notConnected: 'Bağlı değil',
        signInWithGoogle: 'Google ile giriş yap',
        connecting: 'Bağlanıyor...',
        disconnect: 'Bağlantıyı kes',
        useInChatLabel: 'Sohbette Gmail kullan',
        useInChatHint: 'E-postalarınla ilgili sorular sorduğunda ilgili mesajları otomatik okur.',
        inboxTab: 'Gelen Kutusu',
        composeTab: 'Yeni E-posta',
        searchPlaceholder: 'Gmail’de ara (örn. fatura, is:unread)...',
        searchButton: 'Ara',
        refreshTitle: 'Yenile',
        loadingInbox: 'E-postalar yükleniyor...',
        emptyInbox: 'Eşleşen e-posta bulunamadı.',
        unreadLabel: 'Okunmadı',
        attachToChat: 'Sohbete ekle',
        replyButton: 'Yanıtla',
        toLabel: 'Alıcı',
        toPlaceholder: 'ornek@domain.com',
        subjectLabel: 'Konu',
        subjectPlaceholder: 'E-posta konusu',
        bodyLabel: 'Mesaj',
        bodyPlaceholder: 'Mesajını buraya yaz...',
        saveDraftButton: 'Taslak Kaydet',
        sendEmailButton: 'E-posta Gönder',
        confirmSendTitle: 'Bu e-posta Gmail ile gönderilsin mi?',
        confirmDraftTitle: 'Bu taslak Gmail hesabına kaydedilsin mi?',
        confirmSendDesc: 'Onayladığında aşağıdaki e-posta doğrudan Gmail hesabından gönderilecektir.',
        confirmDraftDesc: 'Onayladığında aşağıdaki e-posta Gmail Taslaklar klasörüne kaydedilecektir.',
        confirmSendButton: 'Onayla ve Gönder',
        confirmDraftButton: 'Onayla ve Kaydet',
        cancelButton: 'Vazgeç',
        sending: 'Gönderiliyor...',
        savingDraft: 'Kaydediliyor...',
        sentSuccess: 'E-posta Gmail üzerinden gönderildi.',
        draftSavedSuccess: 'Taslak Gmail hesabına kaydedildi.',
        missingFieldsError: 'Lütfen alıcı e-posta adresini ve konu veya mesaj alanını doldur.',
        sessionExpired: 'Gmail oturumunun süresi doldu. Lütfen tekrar bağlan.',
        connectFailed: 'Gmail bağlantısı tamamlanamadı. Lütfen tekrar dene.',
        draftCardTitle: 'Gmail Taslak Önerisi',
        reviewAndSaveDraft: 'Taslak olarak kaydet',
        reviewAndSend: 'İncele ve gönder',
        connectToSendHint: 'Göndermek veya taslak kaydetmek için önce Gmail’i bağla.',
        readingGmailStatus: 'Gmail kontrol ediliyor…',
      },
    },
  },
  en: {
    common: {
      close: 'Close',
      newChat: 'New chat',
      defaultUser: 'User',
      loading: 'Loading...',
    },
    app: {
      emailVerifiedBanner: 'Your email address has been verified!',
      emailVerifyErrorBanner: 'The email verification link is invalid or has expired.',
    },
    models: {
      'longclaw-clawing-1.2-ultra': {
        tagline: 'Deep Reasoning',
        description: 'Our strongest model for hard problems, research, and complex logic.',
      },
      'longclaw-clawing-1.2-pro': {
        tagline: 'Everyday',
        description: 'Fast and sharp for coding, writing, and daily work.',
      },
      'longclaw-clawing-1.1-ultra': {
        tagline: 'Ultra',
        description: 'Built for long documents and thorough comparisons.',
      },
      'longclaw-clawing-1.1-pro': {
        tagline: 'Pro',
        description: 'Reliable context retention for code and drafts.',
      },
      'longclaw-clawing-1-pro': {
        tagline: 'Classic Pro',
        description: 'Clear, structured answers for steady day-to-day tasks.',
      },
      'longclaw-clawing-1.1-low': {
        tagline: 'Instant',
        description: 'Fastest option for short questions, edits, and translations.',
      },
      'longclaw-clawing-1.1': {
        tagline: 'Standard',
        description: 'Plain, clear conversation for everyday use.',
      },
    },
    nav: {
      whatItDoes: 'Commands',
      depths: 'Depths',
      benchmarks: 'Benchmarks',
      api: 'API',
      faq: 'FAQ',
      toggleTheme: 'Switch theme',
      signIn: 'Sign in',
      start: 'Start',
      chooseLanguage: 'Choose language',
    },
    landing: {
      poweredBy: 'Longclaw AI',
      heroTitleLine1: 'Think faster.',
      heroTitleLine2: 'Build anything.',
      heroSubtitle: 'One workspace for chat, code, images, and your Google apps.',
      startFree: 'Start free',
      benchmarksCta: 'Benchmarks',
      demoConversations: [
        {
          q: 'Summarize the key points from my last three emails',
          a: '1. Design review moved to Thursday 14:00. 2. Q4 budget approved. 3. Waiting on your sign-off for the homepage copy.',
        },
        {
          q: 'Build a clean dark-mode timer I can test right here',
          a: 'Ready in the live preview panel — start, pause, or reset directly beside the chat.',
        },
        {
          q: '/calendar Add a team call tomorrow at 10:00',
          a: 'Added "Team Call" to your calendar for tomorrow, 10:00–11:00.',
        },
      ],
      sidebarMockTitle: 'Workspace',
      familyEyebrow: 'Models',
      familyTitle: 'Pick your speed.',
      familySubtitle: 'Switch models anytime inside the chat bar.',
      compareBenchmarks: 'See full test scores',
      showcaseEyebrow: 'Workspace',
      showcaseTitle: 'Simple tools that work.',
      showcaseCards: {
        reasoningKicker: '01 · Reasoning',
        reasoningTitle: 'See how it thinks.',
        reasoningDesc: 'Open the step-by-step thought process on any complex answer.',
        reasoningAlt: 'Minimalist workspace with structured technical notes',
        codingKicker: '02 · Live Preview',
        codingTitle: 'Run code instantly.',
        codingDesc: 'Preview HTML, apps, and visuals right next to your conversation.',
        codingAlt: 'Live code development and split preview workspace',
      },
      heroImageAlt: 'Calm sunlit alpine ridge and serene dawn horizon',
      depthsImageAlt: 'Three minimalist optical glass blocks representing fast, balanced, and deep reasoning',
      heroThinkingBadge: 'Longclaw',
      timelineTitle: 'Type / and get it done.',
      timelineItems: [
        {
          time: '/gmail',
          title: 'Send emails',
          prompt: '/gmail Send the project update to Maya',
          answer: 'Sent from your Gmail account.',
        },
        {
          time: '/calendar',
          title: 'Add events',
          prompt: '/calendar Lunch with Alex Friday at 13:00',
          answer: 'Added to Google Calendar.',
        },
        {
          time: '/drive',
          title: 'Find files',
          prompt: '/drive Show my Q4 slides',
          answer: 'Found and opened your file from Google Drive.',
        },
        {
          time: '/docs',
          title: 'Create docs',
          prompt: '/docs Write a launch checklist',
          answer: 'Created a new Google Doc with your checklist.',
        },
        {
          time: '/tasks',
          title: 'Save tasks',
          prompt: '/tasks Renew domain before Monday',
          answer: 'Saved to Google Tasks.',
        },
      ],
      depthsTitle: 'Short answer or full breakdown.',
      depthsSubtitle: 'Choose Fast, Balanced, or Deep for any question.',
      depthPrompt: 'How should I price a new software product?',
      depthAnswers: [
        {
          title: 'Fast',
          desc: 'One line, straight to the point.',
          width: '30%',
          text: 'Start with 2–3 simple tiers anchored to the value you save users, not your server cost.',
        },
        {
          title: 'Balanced',
          desc: 'Clear summary and recommendation.',
          width: '65%',
          text: 'Avoid pricing by cost. Look at what your product replaces or saves each month, then price at roughly 10–20% of that value.\n\nKeep it to a free tier to build trust, one clear Pro plan, and a Team plan.',
        },
        {
          title: 'Deep',
          desc: 'Step-by-step full plan.',
          width: '100%',
          text: '1. Value metric: Tie price to something that grows naturally with customer success (seats, projects, or usage).\n2. Tier structure: Free for discovery, Pro ($15–$29/mo) for individuals, Team for shared workflows.\n3. Test early: Launch with annual billing at a 20% discount and raise prices for new users once conversion stays above 5%.',
        },
      ],
      checklistTitle: 'What’s inside',
      checklistItems: [
        'Google, Apple, and email sign-in',
        'Synced across desktop and mobile',
        'Direct /gmail, /calendar, /drive, /docs, and /tasks commands',
        'Custom /commands in Settings',
        'Fast, Balanced, and Deep modes',
        'Live code preview panel',
        'Image upload and generation',
        'Pinned chats and instant search',
        'Clean black & white light and dark themes',
      ],
      mockSearchPlaceholder: 'search chats...',
      mockPinnedTitle: 'Product roadmap',
      mockNote1: 'API architecture',
      mockNote2: 'Sprint plan',
      mockNote3: 'Release list',
      faqTitle: 'Questions',
      faqs: [
        {
          q: 'Is it free?',
          a: 'Yes. Create an account and start right away.',
        },
        {
          q: 'How do Google commands work?',
          a: 'Connect your Google account in Connectors, then type /gmail, /calendar, /drive, /docs, or /tasks in chat.',
        },
        {
          q: 'Can I add my own commands?',
          a: 'Yes. Create and save custom /command shortcuts anytime in Settings.',
        },
        {
          q: 'Can I delete my chats?',
          a: 'Delete any thread in one click, or remove your entire account whenever you want.',
        },
      ],
      getStartedNow: 'Start free',
      footerTagline: 'Chat, code, images, and commands in one place.',
      footerNavHeading: 'Pages',
      footerBackToTop: 'Back to top',
      footerLegalHeading: 'Legal',
      footerPrivacy: 'Privacy Policy',
      footerTerms: 'Terms of Use',
      footerKvkk: 'Data Protection (KVKK)',
      footerCopyright: 'Longclaw © 2026',
    },
    benchmarks: {
      backToHome: 'Back to home',
      eyebrow: 'Evaluation Notes · November 2026',
      title: 'A straightforward look at the numbers.',
      subtitle:
        'We ran the Longclaw model family through language nuance, general knowledge, coding, math, and streaming speed evaluations alongside widely used models under identical prompts.',
      testYourself: 'Try it yourself',
      takeaways: {
        ultra12:
          'Top marks on MMLU-Pro (84.6%) and GPQA Diamond (71.4%)—most dependable when a question takes several careful steps.',
        ultra11:
          'Strong nuance (86.8%) and clean instruction adherence for long research sessions and reviews.',
        pro11:
          'Our balanced Pro tier at 61.2% LiveCodeBench and 88 tok/s—quick enough to stay in flow.',
        low11:
          'Streams at 184 tok/s while keeping 79.8% nuance accuracy for fast everyday checks.',
      },
      tabs: {
        all: 'All',
        general: 'Language & Knowledge',
        coding: 'Coding',
        math: 'Math & Reasoning',
        speed: 'Speed & Compliance',
      },
      legendLongclaw: 'Longclaw models',
      legendOthers: 'Other models',
      cards: {
        'tr-bench': {
          title: 'TR-Bench (Language Nuance & Context)',
          subtitle: 'Idioms, formal register, summarization, and contextual consistency',
          unit: '%',
          note: '5-shot · Human evaluation + automated verification',
        },
        'mmlu-pro': {
          title: 'MMLU-Pro',
          subtitle: 'Multiple-choice knowledge across 14 academic & professional domains',
          unit: '%',
          note: 'Zero-shot CoT · 10-choice rigorous benchmark',
        },
        livecodebench: {
          title: 'LiveCodeBench',
          subtitle: 'Single-attempt pass rate on fresh competitive & algorithmic problems',
          unit: '%',
          note: 'Pass@1 · Contamination-free recent problem set',
        },
        'swe-bench': {
          title: 'SWE-bench Verified',
          subtitle: 'Bug diagnosis and patch generation across real open-source repositories',
          unit: '%',
          note: 'Agentless harness · 500 verified GitHub tasks',
        },
        'math-500': {
          title: 'MATH-500',
          subtitle: 'Competition and olympiad-level multi-step mathematical reasoning',
          unit: '%',
          note: 'Zero-shot · Step-by-step solution verification',
        },
        'gpqa-diamond': {
          title: 'GPQA Diamond',
          subtitle: 'PhD-level reasoning across physics, chemistry, and biology',
          unit: '%',
          note: 'Zero-shot · Subset challenging even to domain experts',
        },
        ifeval: {
          title: 'IFEval (Instruction Following)',
          subtitle: 'Strict adherence to formatting, length, tone, and constraint rules',
          unit: '%',
          note: 'Strict Prompt Accuracy · Critical for daily workflows',
        },
        throughput: {
          title: 'Output Speed (Tokens / sec)',
          subtitle: 'Average tokens generated per second at Balanced thinking effort',
          unit: ' tok/s',
          note: 'Median streaming speed · Higher is faster',
        },
      },
      tableTitle: 'Summary comparison matrix',
      tableSubtitle: 'Core evaluation scores across all models side by side.',
      scrollHint: 'Scroll table horizontally',
      colModel: 'Model',
      colSpeed: 'Speed',
      speedUnit: 'tok/s',
      methodologyNote:
        'Note: Longclaw scores were measured at Balanced/Deep thinking effort, and competing models were evaluated under the same test protocol using publicly available standard API versions.',
      startChatting: 'Start chatting',
    },
    auth: {
      titleForgot: 'Reset Your Password',
      titleDefault: 'Welcome to Longclaw',
      titleSignIn: 'Welcome back',
      titleSignUp: 'Create your account',
      subtitle: 'Pick up where you left off or set up a fresh workspace',
      subtitleSignIn: 'Pick up your conversations right where you left off',
      subtitleSignUp: 'Set up your calm workspace in seconds',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      passwordMinHint: 'At least 6 characters',
      backToSignIn: 'Back to sign in',
      forgotDesc:
        'Enter the email address on your account and we’ll send over a quick verification and reset link.',
      emailPlaceholder: 'Your email address',
      sending: 'Sending...',
      sendVerificationEmail: 'Send Reset Link',
      haveCodePrompt: 'Already got a verification code? Enter it here',
      verificationStepTitle: 'Email Verification',
      verificationStepVerified: (email) =>
        `${email} is verified. Go ahead and choose a new password.`,
      verificationStepDefault:
        'Click the reset link we sent to your inbox, or paste the verification code from that email below.',
      codePlaceholder: 'Verification code or link',
      newPasswordPlaceholder: 'New password (at least 6 characters)',
      verifying: 'Checking...',
      verifyAndUpdatePassword: 'Update Password',
      resendVerificationEmail: 'Send another link',
      continueWithGoogle: 'Continue with Google',
      continueWithApple: 'Continue with Apple',
      orWithEmail: 'or use email',
      tabSignIn: 'Sign in',
      tabSignUp: 'Create account',
      namePlaceholder: 'Your name',
      emailShortPlaceholder: 'Email',
      passwordPlaceholder: 'Password (at least 6 characters)',
      forgotPasswordLink: 'Forgot password?',
      tosPrefix: 'I have read and agree to the ',
      tosTerms: 'Terms of Use',
      tosAnd: ' and ',
      tosPrivacy: 'Privacy Policy',
      tosSuffix: '.',
      processing: 'One moment...',
      createAccount: 'Create account',
      signInBtn: 'Sign in',
      footerSecurity: 'Your conversations stay private and tied only to your account.',
      errors: {
        popupClosed: 'Sign-in window was closed before finishing.',
        accountExistsDifferentCred:
          'That email is already linked to a different sign-in method.',
        googleGeneric: 'Couldn’t finish signing in with Google. Want to try again?',
        applePopupClosed: 'Apple sign-in window was closed.',
        appleNotAllowed: 'Apple sign-in isn’t turned on right now.',
        appleGeneric: 'Something went wrong while signing in with Apple.',
        invalidEmail: 'That doesn’t look like a valid email address.',
        shortPassword: 'Use at least 6 characters for your password.',
        acceptTos: 'Please review and accept the Terms of Use and Privacy Policy first.',
        accountCreatedInfo:
          'You’re all set—we dropped a quick verification link into your inbox.',
        emailInUse: 'That email already has an account. Try signing in instead.',
        invalidCredential: 'Email or password didn’t match.',
        userNotFound: 'We couldn’t find an account with that email.',
        operationNotAllowed:
          'Email sign-in isn’t enabled right now.',
        genericAuth: 'Something went wrong—please try again.',
        invalidEmailReset:
          'Enter a valid email address so we know where to send the reset link.',
        resetSentInfo: (email) =>
          `We sent a reset link to ${email}. Click it in your inbox or paste the code below.`,
        resetUserNotFound: 'No account is registered with that email address.',
        resetSendFailed: (msg) => `Couldn’t send the email: ${msg}`,
        missingResetCode: 'Paste the verification code or link from your email first.',
        shortNewPassword: 'Your new password needs at least 6 characters.',
        resetSuccessInfo: (email) =>
          `${email} is verified and your password is updated. You can sign in now.`,
        expiredActionCode:
          'That code has expired. Go ahead and request a fresh link.',
        invalidActionCode: 'That code looks invalid or was already used.',
        resetVerifyFailed: 'Couldn’t verify that reset code.',
      },
    },
    legal: {
      close: 'Close',
      docs: {
        gizlilik: {
          title: 'Privacy Policy',
          content: [
            'Here is a plain-English overview of what Longclaw stores and how your information is handled.',
            'What we keep: When you sign in, we store your account basics (name, email, photo), your saved chats, and your workspace preferences like theme and language.',
            'Why we keep it: So your threads stay synced between devices, your session stays safe, and Longclaw can answer your prompts.',
            'No data selling: We never sell your conversations or hand your data over for advertising or marketing.',
            'Your control: Delete individual chats anytime, or remove your entire account and all saved history straight from the profile menu.',
          ],
        },
        sartlar: {
          title: 'Terms of Use',
          content: [
            'Welcome to Longclaw. Using the app means you’re okay with these simple ground rules.',
            'What it’s for: Longclaw is a workspace for writing, sorting notes, coding, and thinking through everyday questions.',
            'Double-check important facts: Automated replies can occasionally miss details or get things wrong. Don’t rely on them as a substitute for medical, legal, or financial professionals.',
            'Fair use: Please don’t use the service for harmful, illegal, or disruptive activity.',
            'Account care: Keep your login credentials safe—you’re responsible for activity under your account.',
          ],
        },
        kvkk: {
          title: 'Data Protection Notice (KVKK)',
          content: [
            'Provided in accordance with Law No. 6698 on the Protection of Personal Data (KVKK).',
            'Data processed: Your name, email address, account settings, and the conversations you save.',
            'Purpose: Running your account, syncing chat history across your devices, and keeping your workspace secure.',
            'Storage: Your information is stored in encrypted cloud infrastructure strictly for operating the service.',
            'Your rights: Under Article 11 of KVKK, you can access your data, ask for corrections, or request full deletion anytime.',
          ],
        },
      },
    },
    chat: {
      suggestions: [
        'Explain quantum computing without the jargon',
        'Help me plan a calmer workweek',
        'Write a warm, short thank-you note to a client',
        'Boil this text down to three clear points:',
      ],
      emptyWorkspace: {
        greetingMorning: (name) => `Good morning, ${name}`,
        greetingAfternoon: (name) => `Good afternoon, ${name}`,
        greetingEvening: (name) => `Good evening, ${name}`,
        subtitle: 'Write whatever is on your mind below, drop in a photo or file, or pick a prompt to get moving.',
        tabs: {
          everyday: 'Everyday',
          write: 'Writing',
          code: 'Code',
          gmail: 'Gmail',
        },
        starters: {
          everyday: [
            {
              title: 'Make a tricky topic click',
              subtitle: 'Explain quantum computing without textbook jargon',
              prompt: 'Explain how quantum computing works using simple everyday comparisons, no heavy jargon',
            },
            {
              title: 'Plan a calmer week',
              subtitle: 'Room for real focus, meetings, and breathing space',
              prompt: 'Help me sketch a realistic weekly schedule that protects focus time without burning out',
            },
            {
              title: 'Compare two options clearly',
              subtitle: 'Weigh trade-offs, hidden risks, and get a direct pick',
              prompt: 'Compare these two options with pros, cons, and hidden trade-offs:',
            },
            {
              title: 'Build a 14-day learning path',
              subtitle: 'Hands-on daily milestones from scratch',
              prompt: 'Create a practical 14-day learning roadmap with daily hands-on exercises for:',
            },
          ],
          write: [
            {
              title: 'Write a warm client thank-you',
              subtitle: 'Concise, human, and never robotic',
              prompt: 'Write a warm, concise thank-you email to a client after wrapping up a project',
            },
            {
              title: 'Distill into three key takeaways',
              subtitle: 'Pull out main points and concrete next steps',
              prompt: 'Summarize this text into three key takeaways and any action items:',
            },
            {
              title: 'Tighten and polish a draft',
              subtitle: 'Keep your voice while cutting filler and repetition',
              prompt: 'Tighten and clarify this draft while keeping a natural, human tone:',
            },
            {
              title: 'Turn rough notes into an agenda',
              subtitle: 'Organize decisions, owners, and follow-ups cleanly',
              prompt: 'Organize these rough meeting notes into decisions, owners, and next steps:',
            },
          ],
          code: [
            {
              title: 'Build a live interactive widget',
              subtitle: 'A clean, minimal Pomodoro timer with instant preview',
              prompt: 'Build a clean, minimalist Pomodoro timer in a single HTML file with live preview',
            },
            {
              title: 'Debug and explain a snippet',
              subtitle: 'Identify the root cause and show the cleanest fix',
              prompt: 'Find the root cause of the bug in this code and walk me through the cleanest fix:',
            },
            {
              title: 'Sketch a system diagram',
              subtitle: 'Render a crisp Mermaid architecture flow right in chat',
              prompt: 'Create a clear Mermaid architecture diagram for a modern web app authentication and API flow',
            },
            {
              title: 'Refactor for clarity and speed',
              subtitle: 'Simplify logic without changing behavior',
              prompt: 'Refactor this function to be cleaner, more readable, and faster:',
            },
          ],
          gmail: [
            {
              title: 'Summarize unread emails',
              subtitle: 'Get a calm priority brief of what arrived today',
              prompt: 'Summarize my unread emails in order of priority',
            },
            {
              title: 'Spot messages needing a reply',
              subtitle: 'Surface important threads you should follow up on',
              prompt: 'Check my recent emails and list the ones that look like they need a reply',
            },
            {
              title: 'Find recent receipts or invoices',
              subtitle: 'Pull key amounts, senders, and dates from your inbox',
              prompt: 'Find recent receipts, invoices, or order confirmations in my inbox and summarize them',
            },
            {
              title: 'Draft a thoughtful reply',
              subtitle: 'Review and confirm before saving or sending in Gmail',
              prompt: 'Draft a polite, concise reply to my most recent important email',
            },
          ],
        },
        gmailPromptConnectTitle: 'Bring your Gmail inbox into Longclaw',
        gmailPromptConnectDesc:
          'Summarize unread mail, search receipts and threads, and draft replies with your confirmation.',
        gmailConnectAction: 'Connect Gmail',
        gmailBrowseAction: 'Open Gmail inbox',
        gmailConnectedLabel: 'Gmail connected',
        gmailDisconnectedLabel: 'Connect Gmail',
        quickActionsTitle: 'Workspace tools',
        uploadFileTitle: 'Attach a file',
        uploadFileDesc: 'Drop in code, CSV, Markdown, or notes to analyze right away',
        connectorsCardTitle: 'Gmail connector',
        connectorsCardDescConnected: 'Search your inbox, attach threads, or compose a message',
        connectorsCardDescDisconnected: 'Connect your inbox to summarize threads and draft replies',
        recentChatsTitle: 'Pick up where you left off',
        messagesCount: (count) => `${count} ${count === 1 ? 'message' : 'messages'}`,
      },
      backToLandingTitle: 'Back to landing page',
      closeMenuAria: 'Close menu',
      newChatTitle: 'New chat',
      searchPlaceholder: 'Search chats',
      searchTitle: 'Search chats (Ctrl/⌘+Shift+F)',
      noResults: 'No results found',
      noChatsYet: 'No chats yet',
      unpinTitle: 'Unpin',
      pinTitle: 'Pin to top',
      renameTitle: 'Rename',
      deleteTitle: 'Delete',
      emailVerified: 'Email Verified',
      emailUnverified: 'Email Unverified',
      switchToLight: 'Switch to light theme',
      switchToDark: 'Switch to dark theme',
      switchLanguageLabel: 'Language: English (Switch to Türkçe)',
      signOut: 'Sign out',
      deleteAccountConfirm: 'Are you sure? Click again',
      deleteAccount: 'Delete account & data',
      openSidebarAria: 'Open sidebar',
      sidebarLabel: 'Sidebar',
      hideSidebar: 'Hide sidebar',
      showSidebar: 'Show sidebar',
      depthFast: 'Fast',
      depthFastTitle: 'Fast mode: Direct replies with low thinking effort',
      depthMid: 'Balanced',
      depthMidTitle: 'Balanced mode: Everyday reasoning and balanced effort',
      depthDeep: 'Deep',
      depthDeepTitle: 'Deep mode: Comprehensive analysis with high thinking effort',
      exportMarkdownTitle: 'Copy chat as Markdown',
      emailUnverifiedBanner: (email) => `Your email address (${email}) is not verified yet.`,
      emailVerificationSent: 'Verification link sent again. Please check your inbox.',
      emailSendFailed: 'Could not send verification email.',
      sendVerification: 'Send Verification',
      emailStillUnverified: 'Still looks unverified. Please click the link in your email.',
      checkAgain: 'Check Again',
      helloUser: (name) => `Hello, ${name}`,
      defaultFriendName: 'Friend',
      emptySubtitle: 'Ask a question or try one of the quick prompts below.',
      thoughtsLabel: 'Working notes',
      secondsShort: 's',
      copied: 'Copied',
      copy: 'Copy',
      regenerate: 'Try again',
      thinking: 'Thinking it through…',
      inputPlaceholder: 'Write whatever’s on your mind, or type / for commands...',
      attachFileTitle: 'Attach image or file',
      selectModelTitle: 'Choose model',
      modelSelectionAria: 'Model selection',
      chooseModel: 'Choose a model',
      otherModels: 'Other models',
      stopTitle: 'Stop response',
      sendTitle: 'Send',
      composerHint: 'Enter to send · Shift+Enter for new line',
      effortLow: 'Low Effort',
      effortBalanced: 'Balanced Effort',
      effortHigh: 'High Effort',
      stoppedFallback: 'Response stopped.',
      readBodyError: 'Unable to read response stream.',
      streamError: 'An error occurred while generating a response.',
      noResponseFallback: 'No response received.',
      chatErrorMessage: (msg) => `I couldn't respond right now: ${msg}. Please try again.`,
      connectionError: 'Connection error',
      fileLabel: 'File',
      exportUserLabel: 'You',
      voice: {
        startTitle: 'Speak prompt (Microphone)',
        stopTitle: 'Finish recording & transcribe',
        cancelTitle: 'Cancel voice recording',
        listeningLabel: 'Listening…',
        transcribingLabel: 'Transcribing audio…',
        permissionDenied: 'Microphone permission was denied. Allow microphone access in your browser settings and try again.',
        noMicrophone: 'No microphone was found on this device.',
        notSupported: 'Voice input is not supported in this browser.',
        emptyTranscript: 'No speech detected. Please try again.',
        transcribeFailed: 'Could not transcribe audio. Please try again.',
        maxDurationReached: 'Maximum recording length reached, transcribing…',
      },
      voiceChat: {
        openTitle: 'Voice Chat (Animated Eyes)',
        title: 'Voice Chat',
        tapToSpeak: 'Tap to speak',
        listening: 'Listening to you…',
        transcribing: 'Understanding your voice…',
        thinking: 'Thinking…',
        speaking: 'Speaking…',
        tapToStop: 'Tap to send',
        interrupt: 'Interrupt',
        handsFree: 'Hands-free',
        mute: 'Mute voice',
        unmute: 'Unmute voice',
        eyeAuto: 'Auto',
        eyeRound: 'Round',
        eyeOval: 'Oval',
        eyeSquare: 'Square',
        voiceLabel: 'Voice',
        quickCommands: [
          'Make square eyes & explain recursion',
          'Tell me a quick joke',
          'Switch to oval eyes & help me relax',
          'Do a playful dance!',
        ],
      },
      codePreview: {
        openResult: 'Open result',
        copyCode: 'Copy code',
        copiedCode: 'Copied',
        liveResultTitle: 'Live Result',
        previewTab: 'Preview',
        codeTab: 'Code',
        consoleTab: 'Console',
        rerunTitle: 'Re-run',
        downloadTitle: 'Download file',
        expandTitle: 'Expand fullscreen',
        restoreTitle: 'Restore split view',
        closeTitle: 'Close preview',
        desktopView: 'Desktop view',
        mobileView: 'Mobile view (390px)',
        clearConsole: 'Clear',
        noConsoleOutput: 'No console output yet.',
      },
      connectors: {
        title: 'Connectors',
        subtitle: 'Connect your tools with your permission so Longclaw can work with real data.',
        openButtonTitle: 'Google Workspace Connectors',
        gmailName: 'Gmail',
        gmailDesc: 'Search your inbox, summarize emails, and draft or send replies with your confirmation.',
        connectedAs: (email) => `Connected as ${email}`,
        notConnected: 'Not connected',
        signInWithGoogle: 'Sign in with Google',
        connecting: 'Connecting...',
        disconnect: 'Disconnect',
        useInChatLabel: 'Use Gmail in chat',
        useInChatHint: 'Automatically reads relevant emails when you ask about your inbox or messages.',
        inboxTab: 'Inbox',
        composeTab: 'Compose',
        searchPlaceholder: 'Search Gmail (e.g. invoice, is:unread)...',
        searchButton: 'Search',
        refreshTitle: 'Refresh',
        loadingInbox: 'Loading emails...',
        emptyInbox: 'No matching emails found.',
        unreadLabel: 'Unread',
        attachToChat: 'Ask in chat',
        replyButton: 'Reply',
        toLabel: 'To',
        toPlaceholder: 'name@example.com',
        subjectLabel: 'Subject',
        subjectPlaceholder: 'Email subject',
        bodyLabel: 'Message',
        bodyPlaceholder: 'Write your message here...',
        saveDraftButton: 'Save Draft',
        sendEmailButton: 'Send Email',
        confirmSendTitle: 'Send this email via Gmail?',
        confirmDraftTitle: 'Save this draft to Gmail?',
        confirmSendDesc: 'Once confirmed, this message will be sent directly from your Gmail account.',
        confirmDraftDesc: 'Once confirmed, this message will be saved to your Gmail Drafts folder.',
        confirmSendButton: 'Confirm & Send',
        confirmDraftButton: 'Confirm & Save Draft',
        cancelButton: 'Cancel',
        sending: 'Sending...',
        savingDraft: 'Saving...',
        sentSuccess: 'Email sent via Gmail.',
        draftSavedSuccess: 'Draft saved to your Gmail account.',
        missingFieldsError: 'Please enter a recipient email address and a subject or message.',
        sessionExpired: 'Your Gmail session expired. Please reconnect.',
        connectFailed: 'Could not connect Gmail. Please try again.',
        draftCardTitle: 'Gmail Draft',
        reviewAndSaveDraft: 'Review & save draft',
        reviewAndSend: 'Review & send',
        connectToSendHint: 'Connect Gmail first to save drafts or send emails.',
        readingGmailStatus: 'Checking Gmail…',
      },
    },
  },
};

export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem('lc_lang');
    if (saved === 'en' || saved === 'tr') return saved;
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) {
      return 'tr';
    }
  } catch {}
  return 'en';
}
