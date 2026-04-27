export type ImageBuildResult = {
  imageTag: string;
};

export type ImageBuildLogLine = {
  stream: "stdout" | "stderr";
  message: string;
};

export interface ImageBuilder {
  buildFromPath(input: {
    /** Absolute or container-local path to app source directory. */
    sourcePath: string;
    /** Image tag to build/publish locally, e.g. `brimble/deployment-<id>:latest` */
    imageTag: string;
    /** Optional Railpack override for monorepos / non-standard layouts. */
    buildCommand?: string;
    startCommand?: string;
    /** Arbitrary build args, if supported. */
    buildArgs?: Record<string, string>;
    onLogLine?: (line: ImageBuildLogLine) => void;
  }): Promise<ImageBuildResult>;
}

