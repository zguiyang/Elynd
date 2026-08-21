/** Landing copy — SSOT is the home prototype in temp/gloaming_home_layout_rhythm_optimized. */

export const landingCopy = {
  brand: 'Gloaming',
  nav: {
    philosophy: 'Philosophy',
    signIn: 'Sign In',
    cta: '开始阅读',
    shelf: '我的书架',
    discover: '发现',
    history: '阅读历史',
    menu: '打开菜单',
    account: '账户菜单',
    signOut: '退出登录',
  },
  hero: {
    title: '回来，继续读你想读的英文。',
    subtitle:
      'Gloaming 是一个为真实英文阅读打造的 AI 阅读环境。它不会打断你的阅读，也不会把阅读变成任务。AI 只会在你需要的时候出现，帮助你理解、探索和继续前进。',
    cta: '开始阅读',
  },
  origin: {
    title: '我们为什么创造 Gloaming？',
    paragraphs: [
      '在传统的英文阅读中，我们常常被查字典、翻译软件打断。每一个生词都像是一个路障，让原本沉浸的阅读体验变得支离破碎。',
      '我们相信，语言的习得不是通过完成一个个“任务”来实现的，而是通过大量的、真实的语料输入。阅读本身就应该是目的，而不是手段。',
    ],
    imageAlt: '窗边的阅读场景',
  },
  contrast: {
    title: '真实英语阅读，不应该如此困难。',
    pastTitle: '过去的阅读方式',
    pastItems: ['频繁查字典，打断思路', '生词变成记忆任务，产生压力', '失去阅读上下文，难以继续'],
    nextTitle: '使用 Gloaming',
    nextItems: ['沉浸阅读，自然理解', '无任务感，轻松享受', '保持上下文，顺畅阅读'],
    punch: 'AI 不是老师。AI 不是聊天机器人。AI 是一个安静的阅读伙伴。',
  },
  philosophy: {
    title: '先阅读，再学习。',
    lead: 'Your goal is not to complete lessons. Your goal is to stay with the text.',
    leadZh: '你的目标不是完成课程。而是停留在文字之中。',
    items: [
      {
        title: 'Authentic Content',
        body: '真实内容。阅读原汁原味的英文文本，而不是简化的教材。',
      },
      {
        title: 'Deep Focus',
        body: '深度专注。没有进度条和打卡挑战，只有纯粹的阅读体验。',
      },
      {
        title: 'Quiet Assistance',
        body: '安静辅助。在你需要时提供上下文帮助，不需要时默默退下。',
      },
    ],
  },
  product: {
    title: '一个围绕阅读设计的 AI 环境。',
    reader: {
      title: 'Reader',
      body: '专注阅读体验。舒适字体。干净排版。减少视觉干扰。',
      imageAlt: 'Gloaming Reader 阅读界面',
    },
    companion: {
      title: 'Companion',
      body: '理解词语。解释句子。补充背景。保持阅读连续。',
      cardTitle: 'Companion',
      cardBody:
        'Contextual explanation of the selected text, helping you understand the nuance without leaving the page.',
    },
    shelf: {
      title: 'Shelf',
      body: '保存你的阅读内容。从上次停留的位置继续。',
      imageAlt: 'Gloaming Shelf 书架界面',
    },
  },
  friction: {
    title: '减少阅读摩擦。',
    lead: 'AI 的存在不是为了替代阅读，而是为了保护阅读。',
    pastTitle: '过去的阅读方式',
    pastItems: ['遇到难句。', '停止阅读。', '打开字典或翻译工具。', '失去故事的上下文。', '感到沮丧，放弃阅读。'],
    nextTitle: '使用 Gloaming',
    nextItems: ['遇到难句。', 'AI 辅助悄然出现。', '瞬间理解细微差别。', '保持沉浸在叙事中。', '继续阅读。'],
  },
  invite: {
    title: '重新发现阅读英文的乐趣。',
    body: 'Gloaming 想要成为你和英文世界之间的一座桥梁。我们希望你在这里，不是为了完成学习任务，而是因为热爱阅读本身。',
    cta: '开始阅读',
  },
  footer: {
    tagline: 'Reading, not tasks.',
    links: [
      { href: '#philosophy', label: 'Philosophy' },
      { href: '#origin', label: 'About' },
      { href: '#cta', label: 'Support' },
      { href: '#cta', label: 'Privacy' },
      { href: '#cta', label: 'Terms' },
    ],
  },
} as const;
