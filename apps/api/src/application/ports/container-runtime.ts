export type RunContainerResult = {
  containerName: string;
};

export interface ContainerRuntime {
  runDetached(input: {
    containerName: string;
    image: string;
    network?: string;
    env?: Record<string, string>;
    args?: string[]; // command/args appended after image
  }): Promise<RunContainerResult>;

  stopAndRemove(containerName: string): Promise<void>;
}

