---
name: devcontainer-builder
description: 'Creates secure, reproducible VS Code dev containers for existing projects - Brought to you by willvelida/agentgate-lab'
---

# Dev Container Builder

## Overview

Use this skill when the user asks to create, improve, troubleshoot, or review a
development container for a project.

A dev container is a full-featured development environment that runs inside a
container. A `.devcontainer/devcontainer.json` file tells supporting tools such
as VS Code how to create or connect to that environment and which tools,
settings, extensions, mounts, ports, and lifecycle commands it needs.

Build the smallest configuration that reproduces the project's real
development workflow. Do not turn the development container into a production
deployment image unless the user explicitly asks for both.

## Prerequisites

Before creating or validating a dev container, confirm that:

* A Docker-compatible container runtime is installed and running
* VS Code has the Dev Containers extension when VS Code testing is required
* The project can identify its supported runtime and dependency versions
* Required credentials are available outside source control

If a prerequisite is unavailable, still create a configuration when requested,
but clearly state which validation could not be performed.

## Quick Start

1. Inspect the repository before choosing an image or template.
2. Identify the language, framework, package manager, runtime version, build and
   test commands, required ports, and supporting services.
3. Check for existing Dockerfiles, Compose files, editor settings, version
   files, and CI configuration that establish project conventions.
4. Explain the proposed dev-container design and ask before making a choice that
   materially changes behavior.
5. Create or update the files under `.devcontainer/`.
6. Build the container and run the project's normal checks inside it when the
   required tools are available.
7. Report what was verified and any remaining manual steps.

## Choose the Simplest Configuration

Use this order unless project requirements justify another choice:

1. Improve an existing `.devcontainer` configuration.
2. Use a maintained Dev Container image, template, or Feature for a standard
   toolchain.
3. Add a small Dockerfile when project-specific system setup is required.
4. Use Docker Compose when development requires multiple containers, such as an
   application with a database, cache, or message broker.

Ask the user before choosing between equally reasonable approaches when the
choice affects portability, performance, security, or service behavior.

## Build Workflow

### Inspect the project

Determine:

* Supported language and runtime versions
* Dependency manager and lock files
* Build, test, lint, format, and run commands
* Required operating-system packages
* Required services and their health checks
* Ports developers need to access
* Existing environment-variable conventions
* CPU architecture or host-platform constraints

Use version files, manifests, lock files, CI workflows, and existing
documentation as the source of truth. Do not guess versions when the repository
already defines them.

### Design the environment

Prefer:

* A maintained, trusted base image appropriate for the project's toolchain
* Dev Container Features for standard tools instead of duplicated Dockerfile
  installation logic
* A non-root user with correct workspace ownership
* A bind-mounted workspace and named volumes only for useful caches
* Build-time setup for stable system dependencies
* Lifecycle commands for project dependencies and developer initialization
* Explicit port metadata for developer-facing services

Keep the design portable across the host platforms the project supports.

### Create the configuration

Create only the files the chosen design needs:

```text
.devcontainer/
├── devcontainer.json
├── Dockerfile
└── compose.yaml
```

`devcontainer.json` is required. The Dockerfile and Compose file are optional.
Use clear relative paths within `.devcontainer/`.

Add only project-relevant:

* Features
* Editor extensions and settings
* Forwarded ports and port attributes
* Mounts and named volumes
* Container environment variables
* Lifecycle commands
* User and workspace settings

Avoid duplicating settings already supplied by the selected image or Feature.

### Validate the result

When the environment supports it:

1. Validate the JSON and any Docker or Compose configuration.
2. Build or rebuild the dev container without relying on an old cache when
   checking reproducibility.
3. Confirm the workspace opens under the intended non-root user.
4. Install project dependencies through the configured lifecycle command.
5. Run the smallest relevant build, test, lint, or startup check inside the
   container.
6. Verify required services become healthy and expected ports are reachable.
7. Check that generated files have usable host and container permissions.

Never claim the container works unless the relevant checks actually ran.

## Best Practices

### Reproducibility

* Pin important image, Feature, runtime, and tool versions
* Respect project lock files
* Avoid `latest` for critical inputs unless the user accepts the trade-off
* Keep lifecycle commands repeatable and safe to run after a rebuild
* Document any required manual initialization

### Security

* Use trusted images and Features
* Prefer a non-root user
* Never bake secrets, tokens, SSH keys, or private certificates into an image
* Never commit credentials or secret environment files
* Pass secrets through supported host mechanisms or secret stores
* Forward only required ports
* Avoid privileged mode and host socket mounts unless they are necessary and
  the user accepts the risk

### Maintainability

* Keep the image focused on development requirements
* Minimize Dockerfile layers and remove temporary package-manager files
* Put stable system dependencies in the image
* Put repository-dependent setup in an appropriate lifecycle command
* Add only extensions the project needs
* Reuse existing project commands instead of inventing parallel workflows
* Keep comments short and limited to non-obvious choices

### Performance

* Use named volumes for large dependency caches when they improve host
  filesystem performance
* Order Dockerfile steps so stable dependencies can be cached
* Avoid copying the whole repository into the development image unless the
  design requires it
* Exclude unnecessary build context with `.dockerignore` when using a
  Dockerfile

## Lifecycle Command Guidance

Choose lifecycle commands by when the work must occur:

* `onCreateCommand` for initial container creation tasks
* `updateContentCommand` for tasks affected by new repository content
* `postCreateCommand` for dependency installation and one-time project setup
* `postStartCommand` for tasks needed whenever the container starts
* `postAttachCommand` for tasks needed whenever a developer attaches

Do not start a required long-running application process in an image build.
Use service definitions, project tasks, or an appropriate start command.

## Troubleshooting

### The container does not build

Read the first meaningful Docker build error, inspect the referenced Dockerfile
step, and retry after fixing the root cause. Use a recovery container when VS
Code offers one and the normal container cannot start.

### Files have the wrong owner

Confirm the intended `remoteUser`, container user ID behavior, mount ownership,
and any commands that run as root. Fix ownership at its source instead of
adding broad permission changes.

### Dependencies disappear after rebuild

Check whether a mount hides files created in the image. Move dependency setup
to the correct lifecycle command or use a named volume for the dependency
directory when appropriate.

### Services cannot connect

With Compose, use service names rather than `localhost` for communication
between containers. Verify networks, ports, environment variables, and health
checks.

### The container works only on one machine

Look for host-specific paths, architecture-specific images, unpinned versions,
line-ending assumptions, missing proxy settings, and unsupported mount types.
Make platform constraints explicit when they cannot be removed.

## Reference

Base decisions on the official VS Code guidance:
[Developing inside a Container](https://code.visualstudio.com/docs/devcontainers/containers).
Also follow the open
[Development Containers Specification](https://containers.dev/).

> Brought to you by willvelida/agentgate-lab
