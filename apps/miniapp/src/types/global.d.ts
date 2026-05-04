// Taro 编译时常量声明
declare namespace NodeJS {
  interface ProcessEnv {
    TARO_ENV: 'weapp' | 'tt' | 'h5' | 'rn' | 'qq' | 'jd' | 'quickapp';
    NODE_ENV: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
