FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build

WORKDIR /src

COPY global.json Directory.Build.props ./
COPY src/AcsSpike/AcsSpike.csproj src/AcsSpike/
COPY src/AcsSpike/packages.lock.json src/AcsSpike/

RUN dotnet restore src/AcsSpike/AcsSpike.csproj --locked-mode

COPY src/AcsSpike/ src/AcsSpike/

RUN dotnet publish src/AcsSpike/AcsSpike.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/runtime:10.0-noble

WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "AcsSpike.dll"]
