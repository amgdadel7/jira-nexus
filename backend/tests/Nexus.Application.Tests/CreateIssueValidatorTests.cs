using FluentAssertions;
using Nexus.Application.Issues;

namespace Nexus.Application.Tests;

public class CreateIssueValidatorTests
{
    private readonly CreateIssueValidator _validator = new();

    [Fact]
    public void Rejects_empty_title()
    {
        var result = _validator.Validate(new CreateIssueCommand(Guid.NewGuid(), "", "story", "medium", null, 3, null));
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Accepts_valid_command()
    {
        var result = _validator.Validate(new CreateIssueCommand(Guid.NewGuid(), "Implement SSO", "story", "high", null, 5, "desc"));
        result.IsValid.Should().BeTrue();
    }
}
