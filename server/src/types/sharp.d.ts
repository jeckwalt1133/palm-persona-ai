declare module 'sharp' {
  interface SharpOptions {
    failOn?: string;
    limitInputPixels?: number | false;
    sequentialRead?: boolean;
    density?: number;
    pages?: number;
    page?: number;
    raw?: {
      width: number;
      height: number;
      channels: number;
    };
  }
  
  interface Sharp {
    resize(width?: number, height?: number, options?: { fit?: string; position?: string }): Sharp;
    greyscale(): Sharp;
    threshold(value?: number): Sharp;
    raw(): Sharp;
    toBuffer(options?: { resolveWithObject?: boolean }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>;
  }
  
  function sharp(input?: string | Buffer, options?: SharpOptions): Sharp;
  export = sharp;
}
