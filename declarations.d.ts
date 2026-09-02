/// <reference types="unplugin-icons/types/web-components" />

declare module '~icons/*';

declare module '*.ttl' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
