using System.Runtime.InteropServices;

if (!OperatingSystem.IsLinux() || RuntimeInformation.ProcessArchitecture != Architecture.X64)
{
    Console.Error.WriteLine("The ACS spike container requires Linux x64.");
    return 1;
}

Console.WriteLine($".NET {Environment.Version} ACS spike scaffold running on Linux x64.");
Console.WriteLine("Native ACS policy evaluation is not implemented in this feature.");
return 0;
