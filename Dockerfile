FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build

ARG ACS_NUGET_SOURCE=https://api.nuget.org/v3/index.json

ADD --checksum=sha256:2c0ccdbbe0b8e2a5d12d9c42d92f1f34f494ffb32d1f3c4ddc36101be637d66f \
    https://github.com/open-policy-agent/opa/releases/download/v1.4.2/opa_linux_amd64_static /opt/opa
ADD --checksum=sha256:c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08 \
    https://raw.githubusercontent.com/open-policy-agent/opa/v1.4.2/LICENSE /opt/notices/OPA-LICENSE
ADD --checksum=sha256:7df20dcdf9197e9945c14858d41c60f11b52b93e5b69e2b63416b874d598d322 \
    https://raw.githubusercontent.com/microsoft/agent-governance-toolkit/c57d9d9a4849556a3c5347d359012d7a85bc3dfb/LICENSE /opt/notices/ACS-LICENSE
RUN chmod 0555 /opt/opa

WORKDIR /src

COPY global.json Directory.Build.props ./
COPY src/AcsSpike/AcsSpike.csproj src/AcsSpike/
COPY src/AcsSpike/packages.lock.json src/AcsSpike/

RUN dotnet restore src/AcsSpike/AcsSpike.csproj --locked-mode --source "$ACS_NUGET_SOURCE"

COPY src/AcsSpike/ src/AcsSpike/

RUN dotnet publish src/AcsSpike/AcsSpike.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/runtime:10.0-noble

WORKDIR /app

COPY --from=build /app/publish .
COPY --from=build /opt/opa /usr/local/bin/opa
COPY --from=build /opt/notices /app/notices

ENV ACS_OPA_PATH=/usr/local/bin/opa

ENTRYPOINT ["dotnet", "AcsSpike.dll"]
