using System.Security.Cryptography;
using System.Text;
using Masar.Application.Abstractions;
using Org.BouncyCastle.Crypto.Generators;

namespace Masar.Infrastructure.Services;

public class PasswordHasher : IPasswordHasher
{
    public string HashPassword(string password)
    {
        byte[] saltRaw = RandomNumberGenerator.GetBytes(16);
        string saltHex = Convert.ToHexString(saltRaw).ToLowerInvariant();

        byte[] passwordBytes = Encoding.UTF8.GetBytes(password);
        byte[] saltBytes = Encoding.UTF8.GetBytes(saltHex);
        byte[] derived = SCrypt.Generate(passwordBytes, saltBytes, 16384, 8, 1, 32);
        string hashHex = Convert.ToHexString(derived).ToLowerInvariant();

        return $"{saltHex}:{hashHex}";
    }

    public bool VerifyPassword(string password, string? storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash))
        {
            return false;
        }

        // Demo fallback: if seed data has plain password
        if (storedHash == password)
        {
            return true;
        }

        if (!storedHash.Contains(':'))
        {
            return false;
        }

        var parts = storedHash.Split(':');
        if (parts.Length != 2)
        {
            return false;
        }

        try
        {
            string saltHex = parts[0];
            byte[] expectedHash = Convert.FromHexString(parts[1]);
            byte[] passwordBytes = Encoding.UTF8.GetBytes(password);

            // Node.js passes the hex string to scryptSync, meaning UTF-8 bytes of saltHex
            byte[] saltUtf8 = Encoding.UTF8.GetBytes(saltHex);
            byte[] actualHash = SCrypt.Generate(passwordBytes, saltUtf8, 16384, 8, 1, 32);

            if (CryptographicOperations.FixedTimeEquals(expectedHash, actualHash))
            {
                return true;
            }

            // Fallback: raw hex bytes
            byte[] saltRaw = Convert.FromHexString(saltHex);
            byte[] actualHashRaw = SCrypt.Generate(passwordBytes, saltRaw, 16384, 8, 1, 32);
            return CryptographicOperations.FixedTimeEquals(expectedHash, actualHashRaw);
        }
        catch
        {
            return false;
        }
    }
}
